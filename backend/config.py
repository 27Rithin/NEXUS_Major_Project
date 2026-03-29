import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Default local credentials for development, can be overridden by .env file
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/nexus"
    SECRET_KEY: str = "CHANGE_ME_IN_ENV"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ADMIN_PASSWORD: str = "ChangeMe123"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Thresholds for decision engine
    PRIORITY_THRESHOLD: float = 0.75
    
    # Vision AI Toggle
    ENABLE_VISION_AI: bool = True

    class Config:
        env_file = ".env"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Render uses 'postgres://' but SQLAlchemy requires 'postgresql+psycopg2://'
        if self.DATABASE_URL and self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

settings = Settings()
