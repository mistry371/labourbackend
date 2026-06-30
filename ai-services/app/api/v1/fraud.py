from fastapi import APIRouter
from app.models.schemas import (
    FraudCheckRequest, FraudCheckResponse,
    TicketClassifyRequest, TicketClassifyResponse
)
from app.services.fraud_service import check_fraud, classify_support_ticket

router = APIRouter(prefix="/fraud", tags=["Fraud Detection"])

@router.post("/check", response_model=FraudCheckResponse)
async def fraud_check_endpoint(request: FraudCheckRequest):
    """Check if an action is potentially fraudulent."""
    return check_fraud(request)

@router.post("/classify-ticket", response_model=TicketClassifyResponse)
async def classify_ticket_endpoint(request: TicketClassifyRequest):
    """Automatically classify user disputes or complaints into categories and assign priority."""
    return classify_support_ticket(request)
