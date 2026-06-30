import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import matching, pricing, fraud
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow origins from env or default to backend
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(matching.router, prefix="/api/v1")
app.include_router(pricing.router, prefix="/api/v1")
app.include_router(fraud.router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.app_name}
