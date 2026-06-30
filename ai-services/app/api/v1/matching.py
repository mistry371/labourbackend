from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.models.schemas import MatchRequest, MatchResponse, WorkerCandidate
from app.services.matching_service import rank_workers

router = APIRouter(prefix="/matching", tags=["Matching"])


class MatchRequestWithCandidates(MatchRequest):
    """Extended match request that includes worker candidates fetched by the backend."""
    candidates: List[WorkerCandidate] = []


@router.post("/rank-workers", response_model=MatchResponse)
async def rank_workers_endpoint(request: MatchRequestWithCandidates):
    """
    Rank available workers for a job.
    Node.js backend passes worker candidates fetched from DB.
    Python only computes scores — never touches DB directly.
    """
    ranked = rank_workers(request, request.candidates)
    return MatchResponse(workers=ranked)
