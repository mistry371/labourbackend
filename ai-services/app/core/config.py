from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "LabourPlatform AI Services"
    debug: bool = False
    redis_url: str = "redis://localhost:6379"
    
    # Pricing config
    base_price_per_km: float = 5.0
    surge_multiplier_max: float = 3.0
    
    # Matching config
    max_search_radius_km: float = 20.0
    assignment_expiry_minutes: int = 2

    class Config:
        env_file = ".env"

settings = Settings()
