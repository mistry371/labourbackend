from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Matching ---
class MatchRequest(BaseModel):
    jobId: str
    categoryId: str
    latitude: float
    longitude: float
    radiusKm: float = 10.0
    # IT-specific
    serviceType: Optional[str] = 'physical'   # 'physical' | 'it'
    serviceMode: Optional[str] = 'onsite'     # 'onsite' | 'remote' | 'hybrid'
    deviceType: Optional[str] = None
    brand: Optional[str] = None

class WorkerCandidate(BaseModel):
    workerId: str
    latitude: float
    longitude: float
    rating: float
    acceptanceRate: float
    completionRate: float = 0.0
    jobsCompleted: int
    isOnline: bool
    categoryIds: List[str]
    # IT-specific
    remoteCapable: bool = False
    deviceExpertise: List[str] = []

class RankedWorker(BaseModel):
    workerId: str
    score: float
    distanceKm: float
    rating: float
    acceptanceRate: float

class MatchResponse(BaseModel):
    workers: List[RankedWorker]

# --- Pricing ---
class PriceEstimateRequest(BaseModel):
    categoryId: str
    latitude: float
    longitude: float
    scheduledAt: Optional[str] = None
    demandLevel: Optional[float] = None  # 0-1
    # IT-specific
    serviceType: Optional[str] = 'physical'
    deviceType: Optional[str] = None
    urgency: Optional[str] = None        # 'low' | 'normal' | 'high' | 'critical'

class PriceBreakdown(BaseModel):
    basePrice: float
    distanceSurcharge: float
    demandSurcharge: float
    timeSurcharge: float
    urgencySurcharge: float
    diagnosticFee: float
    total: float

class PriceEstimateResponse(BaseModel):
    estimatedPrice: float
    breakdown: Dict[str, float]
    surgeFactor: float
    diagnosticFee: float

# --- Fraud Detection ---
class FraudCheckRequest(BaseModel):
    userId: str
    action: str  # 'payment', 'job_create', 'withdrawal'
    amount: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class FraudCheckResponse(BaseModel):
    isSuspicious: bool
    riskScore: float  # 0-1
    reasons: List[str]
    recommendation: str  # 'allow', 'review', 'block'

# --- IT Diagnostic ---
class DiagnosticEstimateRequest(BaseModel):
    categoryId: str
    deviceType: str
    brand: Optional[str] = None
    issueType: str
    urgency: str = 'normal'

class DiagnosticEstimateResponse(BaseModel):
    diagnosticFee: float
    estimatedRepairRange: Dict[str, float]  # {"min": x, "max": y}
    commonParts: List[Dict[str, Any]]
    estimatedDurationHours: float

# --- ETA Prediction ---
class EtaRequest(BaseModel):
    latitude: float
    longitude: float
    workerLatitude: float
    workerLongitude: float
    urgency: Optional[str] = 'normal'

class EtaResponse(BaseModel):
    estimatedMinutes: float
    distanceKm: float
    trafficDelayMinutes: float

# --- Smart Recommendations ---
class RecommendationRequest(BaseModel):
    deviceType: str
    issueType: str

class RecommendedService(BaseModel):
    name: str
    description: str
    price: str
    icon: str

class RecommendationResponse(BaseModel):
    recommendations: List[RecommendedService]

# --- Ticket Classification ---
class TicketClassifyRequest(BaseModel):
    content: str

class TicketClassifyResponse(BaseModel):
    category: str
    confidence: float
    priority: str
