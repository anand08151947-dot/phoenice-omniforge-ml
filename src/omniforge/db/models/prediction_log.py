"""PredictionLog model — stores predictions for drift monitoring and active learning."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, JSON, String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base


class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # dataset_id links to datasets.id (String(36) UUID)
    dataset_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    deployment_id: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    # UUID per prediction — used for ground-truth linking
    prediction_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    input_features: Mapped[dict] = mapped_column(JSON, nullable=False)
    prediction: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    ground_truth: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
