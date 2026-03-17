"""FastAPI application factory."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..core.config import settings
from ..core.logging import setup_logging
from .routers import upload, profile, pii, eda, cleaning, sampling, features, selection, training, evaluation, session


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(debug=settings.DEBUG)
    # Ensure MinIO buckets exist on startup
    try:
        from ..storage.minio import get_minio_client
        client = get_minio_client()
        for bucket in [settings.MINIO_BUCKET_DATASETS, settings.MINIO_BUCKET_MODELS]:
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
    except Exception:
        pass  # MinIO may not be available during tests/dev boot
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(session.router, prefix="/api", tags=["session"])
    app.include_router(upload.router, prefix="/api", tags=["datasets"])
    app.include_router(profile.router, prefix="/api", tags=["profile"])
    app.include_router(pii.router, prefix="/api", tags=["pii"])
    app.include_router(eda.router, prefix="/api", tags=["eda"])
    app.include_router(cleaning.router, prefix="/api", tags=["cleaning"])
    app.include_router(sampling.router, prefix="/api", tags=["sampling"])
    app.include_router(features.router, prefix="/api", tags=["features"])
    app.include_router(selection.router, prefix="/api", tags=["selection"])
    app.include_router(training.router, prefix="/api", tags=["training"])
    app.include_router(evaluation.router, prefix="/api", tags=["evaluation"])

    return app


app = create_app()
