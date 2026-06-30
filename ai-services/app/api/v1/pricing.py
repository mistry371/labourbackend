from fastapi import APIRouter
from app.models.schemas import (
    PriceEstimateRequest, PriceEstimateResponse,
    DiagnosticEstimateRequest, DiagnosticEstimateResponse,
    EtaRequest, EtaResponse, RecommendationRequest, RecommendationResponse
)
from app.services.pricing_service import estimate_price
from app.services.diagnostic_service import estimate_diagnostic

router = APIRouter(prefix="/pricing", tags=["Pricing"])

@router.post("/estimate", response_model=PriceEstimateResponse)
async def estimate_price_endpoint(request: PriceEstimateRequest):
    """Dynamic price estimation based on category, time, demand, and IT urgency."""
    return estimate_price(request)

@router.post("/diagnostic-estimate", response_model=DiagnosticEstimateResponse)
async def diagnostic_estimate_endpoint(request: DiagnosticEstimateRequest):
    """Pre-diagnostic fee and repair range estimate for IT service jobs."""
    return estimate_diagnostic(request)

@router.post("/eta", response_model=EtaResponse)
async def eta_endpoint(request: EtaRequest):
    """Predict worker travel ETA based on coordinates and urgency."""
    from app.services.pricing_service import predict_eta
    return predict_eta(request)

@router.post("/recommend", response_model=RecommendationResponse)
async def recommend_endpoint(request: RecommendationRequest):
    """Smart service recommendations based on device and issue."""
    from app.services.pricing_service import recommend_services
    return recommend_services(request)
