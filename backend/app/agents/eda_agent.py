# backend/app/agents/eda_agent.py
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.services.nl_to_sql import _call_gemini_text
from app.state.agent_state import AgentState

logger = logging.getLogger("db_assistant.eda_agent")

SYSTEM_PROMPT = """You are a senior data analyst providing deep EDA insights.

Given a dataset profile, return ONLY valid JSON — no markdown, no explanation.

Output format:
{
  "headline": "One punchy sentence with the single most important finding including actual numbers",
  "key_findings": [
    "Finding 1 — specific and quantitative e.g. 'Asia Pacific leads revenue at $17,328 (54% of total)'",
    "Finding 2 — pattern or trend with actual numbers",
    "Finding 3 — anomaly or outlier worth investigating"
  ],
  "data_quality": {
    "score": 95,
    "issues": ["specific issue with column name and percentage"],
    "verdict": "One sentence health verdict with score justification"
  },
  "column_insights": [
    {
      "col": "column_name",
      "insight": "Specific insight with actual min/max/mean values and what they mean"
    }
  ],
  "recommendations": [
    "Specific actionable recommendation referencing actual column names and values",
    "Second recommendation if genuinely useful"
  ],
  "interesting_facts": [
    "Surprising or notable fact from the data with exact numbers",
    "Another fact the user would not expect"
  ]
}

Rules:
- ALWAYS use actual numbers — never say some, many, high, low without a specific value
- key_findings: exactly 3, ordered by business importance
- column_insights: top 3 most interesting columns only, skip ID columns
- recommendations: max 2, only if genuinely useful
- interesting_facts: 2 surprising observations the user would want to know
- Be direct, specific, and business-focused
"""


def _build_profile_prompt(
    profile: Dict,
    user_question: Optional[str],
    row_count: int,
) -> str:
    col_profiles = profile.get("columns", [])
    warnings = profile.get("warnings", [])

    lines = []
    lines.append(f"Dataset: {row_count} rows × {len(col_profiles)} columns")
    if user_question:
        lines.append(f"Original query: {user_question}")
    lines.append("")

    lines.append("=== COLUMN PROFILES ===")
    for p in col_profiles:
        col = p["col"]
        ctype = p.get("type", "unknown")
        nulls = p.get("null_pct", 0)
        unique = p.get("unique", 0)

        if ctype == "numeric":
            mn = p.get("min")
            mx = p.get("max")
            mean = p.get("mean")
            total = p.get("sum")
            lines.append(
                f"  [{col}] NUMERIC | unique={unique} | nulls={nulls}% | "
                f"min={mn} max={mx} mean={mean} sum={total}"
            )
        else:
            top = p.get("top_values", [])
            top_str = ", ".join(
                f"'{t['value']}'={t['count']}" for t in top[:3]
            )
            lines.append(
                f"  [{col}] TEXT | unique={unique} | nulls={nulls}% | "
                f"top: {top_str}"
            )

    if warnings:
        lines.append("")
        lines.append("=== DATA QUALITY WARNINGS ===")
        for w in warnings:
            lines.append(f"  {w}")

    return "\n".join(lines)


class EDAAgent:
    """
    Agent — Gemini-powered EDA Analysis.

    Uses Gemini to generate intelligent, narrative insights from
    ProfilingAgent's statistical output.

    Reads from:  state.profile, state.user_question, state.results
    Writes to:   state.eda_insights  — structured dict with headline,
                                       findings, quality score, recommendations
                 state.summary       — plain text headline + key findings
    """

    def run(self, state: AgentState) -> AgentState:
        profile = getattr(state, "profile", None)

        if not profile or not profile.get("columns"):
            logger.info("EDAAgent: no profile data, skipping")
            return state

        rows = getattr(state, "results", None) or []
        row_count = len(rows)

        if row_count == 0:
            return state

        try:
            profile_prompt = _build_profile_prompt(
                profile,
                state.user_question,
                row_count,
            )

            raw = _call_gemini_text(SYSTEM_PROMPT, profile_prompt)

            # Strip markdown fences if present
            clean = raw.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[-1]
                clean = clean.rsplit("```", 1)[0]
            clean = clean.strip()

            insights = json.loads(clean)

            # Store structured insights in state
            state.eda_insights = insights

            # Also update summary with headline + findings for Charts tab
            headline = insights.get("headline", "")
            findings = insights.get("key_findings", [])
            if headline:
                summary_parts = [headline]
                summary_parts.extend(findings[:3])
                state.summary = " | ".join(summary_parts)

            logger.info(
                "EDAAgent: generated insights — headline: %s",
                headline[:60] if headline else "none",
            )

        except Exception as e:
            logger.warning("EDAAgent: Gemini call failed (%s), keeping existing summary", e)
            # Non-fatal — profiling data still available in state.profile

        return state