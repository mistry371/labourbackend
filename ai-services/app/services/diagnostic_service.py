"""
IT Diagnostic estimation service.
Returns a pre-diagnostic fee and estimated repair range based on device type and issue.
"""
from app.models.schemas import DiagnosticEstimateRequest, DiagnosticEstimateResponse

# ─── Knowledge base: device × issue → repair range + common parts ─────────────
_DIAGNOSTIC_KB: dict[str, dict] = {
    "laptop": {
        "screen_damage":   {"min": 2500, "max": 8000, "parts": [{"name": "LCD Panel", "estimatedCost": 3500}], "hours": 2.0},
        "no_power":        {"min": 500,  "max": 3000, "parts": [{"name": "Power Adapter", "estimatedCost": 800}, {"name": "DC Jack", "estimatedCost": 400}], "hours": 1.5},
        "slow_performance":{"min": 500,  "max": 2000, "parts": [{"name": "RAM Upgrade", "estimatedCost": 800}, {"name": "SSD", "estimatedCost": 1500}], "hours": 1.0},
        "keyboard_issue":  {"min": 800,  "max": 3000, "parts": [{"name": "Keyboard", "estimatedCost": 1200}], "hours": 1.0},
        "overheating":     {"min": 300,  "max": 1000, "parts": [{"name": "Thermal Paste", "estimatedCost": 150}, {"name": "Cooling Fan", "estimatedCost": 600}], "hours": 1.5},
        "virus_malware":   {"min": 299,  "max": 799,  "parts": [], "hours": 2.0},
        "data_recovery":   {"min": 999,  "max": 4999, "parts": [], "hours": 4.0},
        "default":         {"min": 500,  "max": 3000, "parts": [], "hours": 2.0},
    },
    "printer": {
        "paper_jam":       {"min": 200,  "max": 800,  "parts": [{"name": "Roller Kit", "estimatedCost": 350}], "hours": 1.0},
        "no_print":        {"min": 300,  "max": 1500, "parts": [{"name": "Ink Cartridge", "estimatedCost": 400}, {"name": "Print Head", "estimatedCost": 800}], "hours": 1.5},
        "connectivity":    {"min": 199,  "max": 599,  "parts": [], "hours": 1.0},
        "default":         {"min": 299,  "max": 1200, "parts": [], "hours": 1.5},
    },
    "cctv": {
        "no_video":        {"min": 500,  "max": 2000, "parts": [{"name": "Camera Module", "estimatedCost": 800}], "hours": 2.0},
        "installation":    {"min": 799,  "max": 3000, "parts": [{"name": "Camera", "estimatedCost": 1200}, {"name": "DVR", "estimatedCost": 2500}], "hours": 4.0},
        "default":         {"min": 500,  "max": 2500, "parts": [], "hours": 2.0},
    },
    "networking": {
        "no_internet":     {"min": 199,  "max": 799,  "parts": [{"name": "Router", "estimatedCost": 1200}], "hours": 1.0},
        "slow_speed":      {"min": 199,  "max": 599,  "parts": [], "hours": 1.0},
        "wifi_setup":      {"min": 299,  "max": 799,  "parts": [], "hours": 1.5},
        "default":         {"min": 199,  "max": 799,  "parts": [], "hours": 1.0},
    },
    "default": {
        "default":         {"min": 299,  "max": 1999, "parts": [], "hours": 2.0},
    },
}

_DIAGNOSTIC_FEES: dict[str, float] = {
    "laptop": 99.0,
    "printer": 79.0,
    "cctv": 0.0,      # installation — no diagnostic fee
    "networking": 99.0,
    "default": 99.0,
}

_URGENCY_FEE_MULTIPLIER: dict[str, float] = {
    "low": 1.0, "normal": 1.0, "high": 1.25, "critical": 1.50,
}


def estimate_diagnostic(request: DiagnosticEstimateRequest) -> DiagnosticEstimateResponse:
    device = request.deviceType.lower()
    issue = request.issueType.lower().replace(" ", "_")

    device_kb = _DIAGNOSTIC_KB.get(device, _DIAGNOSTIC_KB["default"])
    issue_data = device_kb.get(issue, device_kb.get("default", _DIAGNOSTIC_KB["default"]["default"]))

    urgency_mult = _URGENCY_FEE_MULTIPLIER.get(request.urgency, 1.0)
    diag_fee = _DIAGNOSTIC_FEES.get(device, _DIAGNOSTIC_FEES["default"]) * urgency_mult

    return DiagnosticEstimateResponse(
        diagnosticFee=round(diag_fee, 2),
        estimatedRepairRange={
            "min": round(issue_data["min"] * urgency_mult, 2),
            "max": round(issue_data["max"] * urgency_mult, 2),
        },
        commonParts=issue_data["parts"],
        estimatedDurationHours=issue_data["hours"],
    )
