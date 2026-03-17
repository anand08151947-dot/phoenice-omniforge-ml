import uuid
from datetime import datetime
import enum

from sqlalchemy import BigInteger, DateTime, Enum as SAEnum, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class DatasetStatus(str, enum.Enum):
    uploading = "uploading"
    processing = "processing"
    ready = "ready"
    error = "error"


class TaskType(str, enum.Enum):
    classification = "classification"
    regression = "regression"
    clustering = "clustering"
    anomaly_detection = "anomaly_detection"
    text_classification = "text_classification"
    forecasting = "forecasting"
    unknown = "unknown"


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    minio_path: Mapped[str] = mapped_column(String(512), nullable=True)
    row_count: Mapped[int] = mapped_column(BigInteger, nullable=True)
    col_count: Mapped[int] = mapped_column(nullable=True)
    status: Mapped[DatasetStatus] = mapped_column(
        SAEnum(DatasetStatus), default=DatasetStatus.uploading
    )
    task_type: Mapped[TaskType] = mapped_column(SAEnum(TaskType), default=TaskType.unknown)
    target_column: Mapped[str] = mapped_column(String(255), nullable=True)
    profile_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    pii_report: Mapped[dict] = mapped_column(JSON, nullable=True)
    eda_report: Mapped[dict] = mapped_column(JSON, nullable=True)
    cleaning_plan: Mapped[dict] = mapped_column(JSON, nullable=True)
    sampling_config: Mapped[dict] = mapped_column(JSON, nullable=True)
    feature_plan: Mapped[dict] = mapped_column(JSON, nullable=True)
    selection_plan: Mapped[dict] = mapped_column(JSON, nullable=True)
    training_results: Mapped[dict] = mapped_column(JSON, nullable=True)
    evaluation_results: Mapped[dict] = mapped_column(JSON, nullable=True)
    # Enterprise multi-project support (nullable for backward compat)
    project_id: Mapped[str] = mapped_column(String(36), nullable=True)
    created_by: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
