"""
Pricing service — computes job price estimates.

Config is loaded from the backend's /api/v1/pricing/config endpoint on first
call and cached in-process. Falls back to hardcoded defaults if the backend
is unreachable (e.g. during local dev without the NestJS server running).
"""
from datetime import datetime
from typing import Optional
import httpx
import os
import logging

from app.models.schemas import (
    PriceEstimateRequest, PriceEstimateResponse,
    EtaRequest, EtaResponse, RecommendationRequest, RecommendationResponse, RecommendedService
)

logger = logging.getLogger(__name__)

import time

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")

# ─── Hardcoded fallback (mirrors DB seed in pricing.service.ts) ───────────────
_FALLBACK_CONFIG: dict[str, dict] = {
    "plumbing":        {"basePrice": 300, "minPrice": 150, "surgeEnabled": True,  "maxSurgeFactor": 3.0, "timeRules": [], "serviceType": "physical"},
    "electrical":      {"basePrice": 350, "minPrice": 150, "surgeEnabled": True,  "maxSurgeFactor": 3.0, "timeRules": [], "serviceType": "physical"},
    "cleaning":        {"basePrice": 250, "minPrice": 150, "surgeEnabled": True,  "maxSurgeFactor": 2.5, "timeRules": [], "serviceType": "physical"},
    "carpentry":       {"basePrice": 400, "minPrice": 200, "surgeEnabled": True,  "maxSurgeFactor": 3.0, "timeRules": [], "serviceType": "physical"},
    "painting":        {"basePrice": 500, "minPrice": 250, "surgeEnabled": False, "maxSurgeFactor": 2.0, "timeRules": [], "serviceType": "physical"},
    "appliance_repair":{"basePrice": 450, "minPrice": 200, "surgeEnabled": True,  "maxSurgeFactor": 3.0, "timeRules": [], "serviceType": "physical"},
    # IT categories
    "laptop_repair":   {"basePrice": 299, "minPrice": 149, "surgeEnabled": False, "maxSurgeFactor": 2.0, "timeRules": [], "serviceType": "it", "diagnosticFee": 99},
    "printer_repair":  {"basePrice": 349, "minPrice": 149, "surgeEnabled": False, "maxSurgeFactor": 2.0, "timeRules": [], "serviceType": "it", "diagnosticFee": 79},
    "cctv_installation":{"basePrice": 799, "minPrice": 499, "surgeEnabled": False,"maxSurgeFactor": 1.5, "timeRules": [], "serviceType": "it", "diagnosticFee": 0},
    "networking":      {"basePrice": 499, "minPrice": 249, "surgeEnabled": False, "maxSurgeFactor": 2.0, "timeRules": [], "serviceType": "it", "diagnosticFee": 99},
    "data_recovery":   {"basePrice": 999, "minPrice": 499, "surgeEnabled": False, "maxSurgeFactor": 2.0, "timeRules": [], "serviceType": "it", "diagnosticFee": 149},
    "software_support":{"basePrice": 199, "minPrice": 99,  "surgeEnabled": False, "maxSurgeFactor": 1.5, "timeRules": [], "serviceType": "it", "diagnosticFee": 49},
}
_DEFAULT_FALLBACK = {"basePrice": 300, "minPrice": 150, "surgeEnabled": True, "maxSurgeFactor": 3.0, "timeRules": []}

# TTL-based cache: refresh every 5 minutes
_CONFIG_TTL_SECONDS = 300
_config_cache: dict[str, dict] | None = None
_config_fetched_at: float = 0.0


def _fetch_config() -> dict[str, dict]:
    """Fetch pricing config from backend with TTL cache. Returns fallback on error."""
    global _config_cache, _config_fetched_at
    now = time.monotonic()
    if _config_cache is not None and (now - _config_fetched_at) < _CONFIG_TTL_SECONDS:
        return _config_cache
    try:
        resp = httpx.get(f"{BACKEND_URL}/api/v1/pricing/config", timeout=2.0)
        resp.raise_for_status()
        _config_cache = resp.json()
        _config_fetched_at = now
        return _config_cache
    except Exception as exc:
        logger.warning("Could not fetch pricing config from backend (%s), using fallback", exc)
        return _config_cache or _FALLBACK_CONFIG


def _get_category_config(category_id: str) -> dict:
    config = _fetch_config()
    return config.get(category_id, _DEFAULT_FALLBACK)


# ─── Built-in time rules (applied when DB rules are empty / surge disabled) ───
def _builtin_time_factor(dt: datetime) -> float:
    hour = dt.hour
    weekday = dt.weekday()  # 0=Mon … 6=Sun
    if weekday >= 5:
        return 1.25
    if hour < 7 or hour >= 21:
        return 1.20
    if 18 <= hour < 21:
        return 1.10
    return 1.0


def _apply_time_rules(dt: datetime, time_rules: list[dict]) -> float:
    """
    Evaluate DB-driven time rules. Returns the highest matching multiplier.
    Falls back to built-in rules if no DB rules are defined.
    """
    if not time_rules:
        return _builtin_time_factor(dt)

    hour = dt.hour
    weekday = dt.weekday()  # 0=Mon … 6=Sun (Python convention)
    # Convert to JS convention (0=Sun … 6=Sat) to match frontend/DB storage
    js_weekday = (weekday + 1) % 7

    best = 1.0
    for rule in time_rules:
        if not rule.get("enabled", True):
            continue
        days: list[int] = rule.get("days", [])
        start: int = rule.get("startHour", 0)
        end: int = rule.get("endHour", 24)
        multiplier: float = rule.get("multiplier", 1.0)

        # Day match — empty days list means all days
        day_match = (not days) or (js_weekday in days)
        if not day_match:
            continue

        # Hour match — handle overnight wrap (e.g. 21–7)
        if start <= end:
            hour_match = start <= hour < end
        else:
            hour_match = hour >= start or hour < end

        if hour_match:
            best = max(best, multiplier)

    return best


def _demand_factor(demand_level: Optional[float]) -> float:
    if demand_level is None:
        return 1.0
    d = max(0.0, min(1.0, demand_level))
    if d > 0.90:
        return 2.0
    if d > 0.70:
        return 1.50
    if d > 0.50:
        return 1.25
    return 1.0


def _urgency_factor(urgency: Optional[str]) -> float:
    """IT-specific urgency surcharge multiplier."""
    mapping = {"low": 1.0, "normal": 1.0, "high": 1.25, "critical": 1.50}
    return mapping.get(urgency or "normal", 1.0)


def estimate_price(request: PriceEstimateRequest) -> PriceEstimateResponse:
    cfg = _get_category_config(request.categoryId)

    base: float = float(cfg["basePrice"])
    min_price: float = float(cfg["minPrice"])
    surge_enabled: bool = cfg["surgeEnabled"]
    max_surge: float = float(cfg["maxSurgeFactor"])
    time_rules: list[dict] = cfg.get("timeRules", [])
    service_type: str = cfg.get("serviceType", "physical")
    diagnostic_fee: float = float(cfg.get("diagnosticFee", 0))

    try:
        dt = datetime.fromisoformat(request.scheduledAt) if request.scheduledAt else datetime.now()
    except (ValueError, TypeError):
        dt = datetime.now()

    if surge_enabled:
        tf = _apply_time_rules(dt, time_rules)
        df = _demand_factor(request.demandLevel)
        raw_surge = tf * df
        surge_factor = round(min(raw_surge, max_surge), 2)
    else:
        tf = 1.0
        df = 1.0
        surge_factor = 1.0

    # IT urgency surcharge (applied on top of base, not surge)
    uf = _urgency_factor(request.urgency) if service_type == "it" else 1.0
    urgency_surcharge = round(base * (uf - 1.0), 2)

    total = max(base * surge_factor + urgency_surcharge, min_price)

    time_surcharge = round(base * (tf - 1.0), 2)
    demand_surcharge = round(base * (df - 1.0), 2)

    return PriceEstimateResponse(
        estimatedPrice=round(total, 2),
        breakdown={
            "basePrice": base,
            "timeSurcharge": time_surcharge,
            "demandSurcharge": demand_surcharge,
            "urgencySurcharge": urgency_surcharge,
            "distanceSurcharge": 0.0,
            "diagnosticFee": diagnostic_fee,
            "total": round(total, 2),
        },
        surgeFactor=surge_factor,
        diagnosticFee=diagnostic_fee,
    )

def predict_eta(request: EtaRequest) -> EtaResponse:
    from app.services.matching_service import haversine_distance
    distance = haversine_distance(
        request.latitude, request.longitude,
        request.workerLatitude, request.workerLongitude
    )
    base_minutes = distance * 2.0
    traffic_delay = 5.0
    if request.urgency == 'critical':
        traffic_delay = 1.0
    elif request.urgency == 'high':
        traffic_delay = 3.0
    elif request.urgency == 'low':
        traffic_delay = 7.0

    total_minutes = base_minutes + traffic_delay
    return EtaResponse(
        estimatedMinutes=round(total_minutes, 1),
        distanceKm=round(distance, 2),
        trafficDelayMinutes=round(traffic_delay, 1)
    )

def recommend_services(request: RecommendationRequest) -> RecommendationResponse:
    device = request.deviceType.lower()
    issue = request.issueType.lower()
    recs = []
    if device == 'laptop':
        recs.append(RecommendedService(
            name="Antivirus & Security Installation",
            description="Install premium antivirus and perform full malware clean.",
            price="₹299",
            icon="🛡️"
        ))
        recs.append(RecommendedService(
            name="SSD Speed Upgrade",
            description="Upgrade storage to SSD for 10x faster boot times.",
            price="₹1,500",
            icon="⚡"
        ))
    elif device == 'printer':
        recs.append(RecommendedService(
            name="Printer Roller Replacement",
            description="Fix paper jams permanently with new feeder rollers.",
            price="₹350",
            icon="⚙️"
        ))
    elif device == 'cctv':
        recs.append(RecommendedService(
            name="CCTV Annual Maintenance Contract",
            description="Get 24/7 priority support and quarterly health checks.",
            price="₹1,999",
            icon="📅"
        ))
    else:
        recs.append(RecommendedService(
            name="Smart Home WiFi Extension",
            description="Eliminate dead spots with premium mesh routers.",
            price="₹999",
            icon="📶"
        ))
        recs.append(RecommendedService(
            name="Whole Home IT Health Check",
            description="Diagnose all routers, laptops, and CCTV cameras.",
            price="₹499",
            icon="🏥"
        ))
    return RecommendationResponse(recommendations=recs)
