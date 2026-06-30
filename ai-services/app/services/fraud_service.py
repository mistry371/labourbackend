from app.models.schemas import (
    FraudCheckRequest, FraudCheckResponse,
    TicketClassifyRequest, TicketClassifyResponse
)

def check_fraud(request: FraudCheckRequest) -> FraudCheckResponse:
    """
    Rule-based fraud detection.
    In production: replace with ML model (Isolation Forest, XGBoost, etc.)
    """
    risk_score = 0.0
    reasons = []

    # Rule 1: Unusually high payment amount
    if request.action == "payment" and request.amount:
        if request.amount > 50000:
            risk_score += 0.4
            reasons.append("Unusually high payment amount")
        elif request.amount > 20000:
            risk_score += 0.2
            reasons.append("High payment amount")

    # Rule 2: Rapid successive actions (would check Redis in production)
    metadata = request.metadata or {}
    if metadata.get("actionsInLastHour", 0) > 20:
        risk_score += 0.3
        reasons.append("High frequency of actions")

    # Rule 3: New account with high-value transaction
    if metadata.get("accountAgeDays", 999) < 1 and request.amount and request.amount > 5000:
        risk_score += 0.3
        reasons.append("New account with high-value transaction")

    # Rule 4: Withdrawal to new bank account
    if request.action == "withdrawal" and metadata.get("bankAccountAgeDays", 999) < 7:
        risk_score += 0.2
        reasons.append("Withdrawal to recently added bank account")

    risk_score = min(1.0, risk_score)

    if risk_score >= 0.7:
        recommendation = "block"
    elif risk_score >= 0.4:
        recommendation = "review"
    else:
        recommendation = "allow"

    return FraudCheckResponse(
        isSuspicious=risk_score >= 0.4,
        riskScore=round(risk_score, 2),
        reasons=reasons,
        recommendation=recommendation,
    )

def classify_support_ticket(request: TicketClassifyRequest) -> TicketClassifyResponse:
    content = request.content.lower()
    if any(k in content for k in ['charge', 'refund', 'price', 'payment', 'money', 'fee', 'billing', 'coupon', 'wallet', 'deduct']):
        category = 'billing'
        confidence = 0.85
        priority = 'medium'
    elif any(k in content for k in ['technician', 'worker', 'guy', 'technician behavior', 'rude', 'behaviour', 'person', 'professional']):
        category = 'technician_behavior'
        confidence = 0.80
        priority = 'high'
    elif any(k in content for k in ['broken', 'damage', 'worse', 'quality', 'not working', 'fix', 'work', 'issue', 'defect']):
        category = 'service_quality'
        confidence = 0.90
        priority = 'high'
    elif any(k in content for k in ['app', 'website', 'login', 'bug', 'crash', 'error', 'slow', 'software']):
        category = 'software_issue'
        confidence = 0.75
        priority = 'low'
    else:
        category = 'other'
        confidence = 0.50
        priority = 'low'

    if any(k in content for k in ['urgent', 'emergency', 'immediately', 'scam', 'fraud', 'police', 'court', 'worst', 'terrible']):
        priority = 'high'

    return TicketClassifyResponse(
        category=category,
        confidence=confidence,
        priority=priority
    )
