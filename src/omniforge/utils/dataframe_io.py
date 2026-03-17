"""Shared helper for reading DataFrames from raw bytes with multi-format support."""
from __future__ import annotations

import io

import pandas as pd


def read_dataframe(raw: bytes, filename: str) -> pd.DataFrame:
    """Read a DataFrame from raw bytes, selecting the parser by file extension.

    Supports: .csv, .tsv, .txt (auto-delimiter), .xlsx, .xls, .parquet, .json
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"

    if ext == "xlsx":
        return pd.read_excel(io.BytesIO(raw), engine="openpyxl")
    if ext == "xls":
        return pd.read_excel(io.BytesIO(raw))
    if ext == "parquet":
        return pd.read_parquet(io.BytesIO(raw))
    if ext == "json":
        return pd.read_json(io.BytesIO(raw))

    # csv / txt / tsv — try common separators
    for sep in [",", ";", "\t", "|"]:
        try:
            df = pd.read_csv(io.BytesIO(raw), sep=sep)
            if len(df.columns) > 1:
                return df
        except Exception:
            pass
    return pd.read_csv(io.BytesIO(raw))
