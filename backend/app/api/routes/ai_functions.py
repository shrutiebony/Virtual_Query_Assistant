# backend/app/api/routes/ai_functions.py
# Simulates AlloyDB's ai.generate, ai.if, ai.rank using Gemini API

from __future__ import annotations

import json
import os
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from google import genai
from google.genai import errors as genai_errors

from app.api.routes.auth import get_current_user

logger = logging.getLogger("db_assistant.ai_functions")
router = APIRouter(prefix="/ai", tags=["ai-functions"])


# ─── Gemini helper ────────────────────────────────────────────
def _call_gemini(system: str, prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    client = genai.Client(api_key=api_key)
    try:
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[system, prompt],
        )
        return (resp.text or "").strip()
    except genai_errors.ClientError as e:
        raise RuntimeError(f"Gemini API error: {e}")
    except Exception as e:
        raise RuntimeError(f"Gemini call failed: {e}")


# ─── Request models ───────────────────────────────────────────
class AiGenerateRequest(BaseModel):
    rows: List[Dict[str, Any]]
    prompt: str          # e.g. "Summarize this row and classify severity"
    output_column: str = "ai_insight"   # name of new column added to each row

class AiIfRequest(BaseModel):
    rows: List[Dict[str, Any]]
    condition: str       # e.g. "Is this feedback negative?"

class AiRankRequest(BaseModel):
    rows: List[Dict[str, Any]]
    criteria: str        # e.g. "Rank by most critical error first"


# ─── 1. ai.generate equivalent ────────────────────────────────
# Adds a new AI-generated column to every row
@router.post("/generate")
def ai_generate(req: AiGenerateRequest, user=Depends(get_current_user)):
    """
    Simulates AlloyDB's ai.generate().
    For each row, calls Gemini with the user's prompt + row data.
    Returns rows with an extra AI-generated column.
    """
    if not req.rows:
        raise HTTPException(400, "No rows provided")
    if len(req.rows) > 100:
        raise HTTPException(400, "Maximum 100 rows allowed for AI enrichment")

    SYSTEM = """You are a data analyst. 
For each database row provided, respond with ONLY a single JSON object with one key: "result".
The value must be a concise string (max 2 sentences).
No markdown, no explanation, just the JSON object."""

    enriched = []
    for row in req.rows:
        row_str = json.dumps(row, default=str)
        prompt = f"{req.prompt}\n\nRow data:\n{row_str}\n\nReturn ONLY: {{\"result\": \"...\"}}"
        try:
            raw = _call_gemini(SYSTEM, prompt)
            # Strip markdown fences if present
            raw = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw)
            ai_value = parsed.get("result", raw)
        except Exception as e:
            logger.warning(f"ai.generate failed for row: {e}")
            ai_value = "Analysis unavailable"

        enriched.append({**row, req.output_column: ai_value})

    return {
        "rows": enriched,
        "output_column": req.output_column,
        "total": len(enriched)
    }


# ─── 2. ai.if equivalent ──────────────────────────────────────
# Filters rows using a natural language true/false condition
@router.post("/if")
def ai_if(req: AiIfRequest, user=Depends(get_current_user)):
    """
    Simulates AlloyDB's ai.if().
    For each row, asks Gemini if the condition is true.
    Returns only the rows where Gemini says true.
    """
    if not req.rows:
        raise HTTPException(400, "No rows provided")
    if len(req.rows) > 200:
        raise HTTPException(400, "Maximum 200 rows allowed for AI filtering")

    SYSTEM = """You are a data filter.
For each row, answer ONLY with a JSON object: {"match": true} or {"match": false}.
No explanation. No markdown. Just the JSON."""

    matched = []
    total_checked = len(req.rows)

    for row in req.rows:
        row_str = json.dumps(row, default=str)
        prompt = f"""Condition: {req.condition}

Row data:
{row_str}

Does this row match the condition? Return ONLY: {{"match": true}} or {{"match": false}}"""
        try:
            raw = _call_gemini(SYSTEM, prompt)
            raw = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw)
            if parsed.get("match") is True:
                matched.append(row)
        except Exception as e:
            logger.warning(f"ai.if failed for row: {e}")
            # On error, include the row (fail-open)
            matched.append(row)

    return {
        "rows": matched,
        "total_checked": total_checked,
        "matched": len(matched),
        "filtered_out": total_checked - len(matched),
        "condition": req.condition
    }


# ─── 3. ai.rank equivalent ────────────────────────────────────
# Reorders rows using semantic ranking criteria
@router.post("/rank")
def ai_rank(req: AiRankRequest, user=Depends(get_current_user)):
    """
    Simulates AlloyDB's ai.rank().
    Sends all rows to Gemini with a ranking criteria.
    Returns rows reordered by semantic relevance.
    """
    if not req.rows:
        raise HTTPException(400, "No rows provided")
    if len(req.rows) > 50:
        raise HTTPException(400, "Maximum 50 rows allowed for AI ranking")

    SYSTEM = """You are a data ranking engine.
You will receive a list of rows and a ranking criteria.
Return ONLY a JSON array of row indices (0-based) ordered from most relevant to least relevant.
Example: [2, 0, 4, 1, 3]
No explanation. No markdown. Just the JSON array."""

    rows_str = json.dumps(
        [{"index": i, **row} for i, row in enumerate(req.rows)],
        default=str
    )

    prompt = f"""Ranking criteria: {req.criteria}

Rows to rank (with index):
{rows_str}

Return ONLY a JSON array of indices ordered best to worst, e.g. [2, 0, 1]"""

    try:
        raw = _call_gemini(SYSTEM, prompt)
        raw = raw.replace("```json", "").replace("```", "").strip()

        # Handle both bare array and wrapped object
        if raw.startswith("["):
            indices = json.loads(raw)
        else:
            parsed = json.loads(raw)
            indices = parsed if isinstance(parsed, list) else list(parsed.values())[0]

        # Validate indices
        valid = [i for i in indices if isinstance(i, int) and 0 <= i < len(req.rows)]

        # Append any rows that weren't ranked (safety net)
        all_indices = list(range(len(req.rows)))
        missing = [i for i in all_indices if i not in valid]
        final_order = valid + missing

        ranked_rows = [req.rows[i] for i in final_order]

    except Exception as e:
        logger.warning(f"ai.rank failed: {e}")
        # Return original order on failure
        ranked_rows = req.rows
        final_order = list(range(len(req.rows)))

    return {
        "rows": ranked_rows,
        "order": final_order,
        "criteria": req.criteria,
        "total": len(ranked_rows)
    }