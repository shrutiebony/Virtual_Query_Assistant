# backend/app/agents/swarm_summary_agent.py
"""
Swarm Summary Agent.

Takes results from multiple parallel agents and combines them into
a unified business intelligence report.
"""
from __future__ import annotations

import json
import logging
import re
from typing import List, Dict, Any
from app.services.nl_to_sql import _call_gemini_text

logger = logging.getLogger("db_assistant.swarm_summary")

SYSTEM_PROMPT = """You are a senior business intelligence analyst.
You receive results from multiple parallel data queries and produce a unified analysis.

Return ONLY valid JSON — no markdown, no explanation:
{
  "executive_summary": "2-3 sentence high-level business summary with specific numbers",
  "key_insights": [
    "Specific insight 1 with actual numbers from the data",
    "Specific insight 2 with actual numbers from the data",
    "Specific insight 3 with actual numbers from the data"
  ],
  "recommendations": [
    "Actionable recommendation 1 based on the data",
    "Actionable recommendation 2 based on the data"
  ],
  "headline": "One punchy sentence summarizing the most important finding"
}

Rules:
- Always use ACTUAL numbers from the provided data
- Be specific — never say "some" or "many", always give exact figures
- Recommendations must be actionable and data-driven
"""


def summarize_swarm_results(
    original_question: str,
    subtask_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Use Gemini to generate a unified summary from all parallel agent results.
    Falls back to a basic summary if Gemini fails.
    """
    # Build context for Gemini
    context_parts = [f"Original question: {original_question}\n"]

    for i, result in enumerate(subtask_results):
        if result.get("error"):
            context_parts.append(
                f"Query {i+1}: '{result['question']}'\n"
                f"Result: Failed — {result['error']}\n"
            )
        else:
            rows  = result.get("data", [])[:5]  # first 5 rows for context
            count = result.get("count", 0)
            context_parts.append(
                f"Query {i+1}: '{result['question']}'\n"
                f"Rows returned: {count}\n"
                f"Sample data: {json.dumps(rows, default=str)}\n"
            )

    context = "\n".join(context_parts)

    try:
        raw = _call_gemini_text(SYSTEM_PROMPT, context)
        raw = raw.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        summary = json.loads(raw)
        logger.info("SwarmSummary: generated unified summary")
        return summary
    except Exception as e:
        logger.warning("SwarmSummary: Gemini failed (%s), using fallback", e)

    # Fallback — build basic summary
    successful = [r for r in subtask_results if not r.get("error")]
    total_rows = sum(r.get("count", 0) for r in successful)
    return {
        "headline": f"Analysis complete — {len(successful)} queries returned {total_rows} total rows",
        "executive_summary": (
            f"Completed {len(successful)} of {len(subtask_results)} parallel queries "
            f"returning {total_rows} total rows across all analyses."
        ),
        "key_insights": [
            f"Query '{r['question']}' returned {r.get('count', 0)} rows"
            for r in successful[:3]
        ],
        "recommendations": [
            "Review the individual query results for detailed insights."
        ],
    }