# backend/app/api/routes/benchmark.py
from __future__ import annotations
import json
import math
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/benchmark", tags=["benchmark"])
RESULTS_PATH = Path(__file__).parent.parent.parent.parent / "benchmark_results.json"

def _clean(obj):
    """Recursively replace NaN/Inf with None for JSON compliance."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return obj

@router.get("/results")
def get_benchmark_results():
    if not RESULTS_PATH.exists():
        raise HTTPException(404, detail="No benchmark results found.")
    try:
        with open(RESULTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return JSONResponse(content=_clean(data))
    except Exception as e:
        raise HTTPException(500, detail=f"Could not read results: {e}")

@router.get("/status")
def get_benchmark_status():
    exists = RESULTS_PATH.exists()
    if exists:
        with open(RESULTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"has_results": True, "total": data.get("total", 0), "accuracy": data.get("accuracy", 0)}
    return {"has_results": False}