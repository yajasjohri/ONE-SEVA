import os
from dataclasses import dataclass


@dataclass
class Settings:
    environment: str = os.getenv("FLASK_ENV", "production")
    port: int = int(os.getenv("PORT", "5001"))
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-me")


settings = Settings()


