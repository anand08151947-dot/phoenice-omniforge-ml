from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://omniforge:omniforge@localhost:5432/omniforge"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_DATASETS: str = "datasets"
    MINIO_BUCKET_MODELS: str = "models"
    MINIO_SECURE: bool = False

    # MLflow
    MLFLOW_TRACKING_URI: str = "http://localhost:5001"

    # App
    APP_NAME: str = "OmniForge ML"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ]

    # LM Studio (optional)
    LM_STUDIO_BASE_URL: str = "http://localhost:1234/v1"
    LM_STUDIO_MODEL: str = "local-model"


settings = Settings()
