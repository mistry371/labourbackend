import math
from typing import List
from app.models.schemas import MatchRequest, WorkerCandidate, RankedWorker

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two coordinates."""
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def compute_worker_score(
    worker: WorkerCandidate,
    distance_km: float,
    max_distance: float,
    request: MatchRequest,
) -> float:
    """
    Multi-factor scoring.

    Physical jobs:
      Distance 40% | Rating 30% | Acceptance 20% | Experience 10%

    IT jobs (remote):
      Rating 40% | Experience 30% | Acceptance 20% | Device expertise 10%

    IT jobs (onsite/hybrid):
      Distance 30% | Rating 30% | Experience 20% | Acceptance 15% | Device expertise 5%
    """
    rating_score = worker.rating / 5.0
    acceptance_score = worker.acceptanceRate / 100.0
    experience_score = min(1.0, worker.jobsCompleted / 100.0)
    distance_score = max(0.0, 1.0 - (distance_km / max_distance)) if max_distance > 0 else 1.0

    # Device expertise bonus for IT jobs
    device_match = 0.0
    if request.serviceType == 'it' and request.deviceType:
        device_match = 1.0 if request.deviceType in worker.deviceExpertise else 0.0

    if request.serviceType == 'it':
        if request.serviceMode == 'remote':
            score = (
                0.40 * rating_score +
                0.30 * experience_score +
                0.20 * acceptance_score +
                0.10 * device_match
            )
        else:  # onsite or hybrid
            score = (
                0.30 * distance_score +
                0.30 * rating_score +
                0.20 * experience_score +
                0.15 * acceptance_score +
                0.05 * device_match
            )
    else:
        score = (
            0.40 * distance_score +
            0.30 * rating_score +
            0.20 * acceptance_score +
            0.10 * experience_score
        )

    return round(score, 4)

def rank_workers(request: MatchRequest, candidates: List[WorkerCandidate]) -> List[RankedWorker]:
    """Rank worker candidates for a job."""
    ranked = []
    is_remote = request.serviceMode == 'remote'

    for worker in candidates:
        if not worker.isOnline:
            continue
        if request.categoryId not in worker.categoryIds:
            continue

        # Remote IT jobs: skip distance check, use 0 distance
        if is_remote:
            distance = 0.0
        else:
            distance = haversine_distance(
                request.latitude, request.longitude,
                worker.latitude, worker.longitude,
            )
            if distance > request.radiusKm:
                continue

        # Remote IT: must have remote capability
        if request.serviceType == 'it' and is_remote and not worker.remoteCapable:
            continue

        score = compute_worker_score(worker, distance, request.radiusKm, request)
        ranked.append(RankedWorker(
            workerId=worker.workerId,
            score=score,
            distanceKm=round(distance, 2),
            rating=worker.rating,
            acceptanceRate=worker.acceptanceRate,
        ))

    ranked.sort(key=lambda w: w.score, reverse=True)
    return ranked[:10]
