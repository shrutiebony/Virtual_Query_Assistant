# backend/app/agents/swarm_planner_agent.py
"""
Swarm Planner Agent.

Takes a high-level user question and breaks it into 2-4 parallel subtasks.
Each subtask is a focused question that can be answered independently.

Example:
  Input:  "Give me a full business analysis of sales"
  Output: [
    "Show total revenue by region",
    "Show top 5 products by total sales",
    "Show monthly revenue trend",
    "Show average order value by customer segment"
  ]
"""
from __future__ import annotations

import json
import logging
import re
from typing import List
from app.services.nl_to_sql import _call_gemini_text

logger = logging.getLogger("db_assistant.swarm_planner")

SYSTEM_PROMPT = """You are a data analysis planner.
Your job is to break a complex analytical question into 2-4 focused sub-questions.
Each sub-question must be independently answerable with a single SQL query.

Rules:
- Return ONLY a JSON array of strings — no markdown, no explanation
- Each sub-question should be specific and focused
- 2 sub-questions for simple requests, 3-4 for complex analysis requests
- Sub-questions should cover different angles of the original question
- Keep each sub-question concise (under 15 words)

Example output:
["Show total revenue by region", "Show top 5 products by sales", "Show monthly revenue trend"]
"""


def plan_subtasks(question: str, table_names: List[str]) -> List[str]:
    """
    Use Gemini to split a question into parallel subtasks.
    Falls back to a simple split if Gemini fails.
    """
    tables_str = ", ".join(table_names[:10])
    prompt = (
        f"Available tables: {tables_str}\n\n"
        f"User question: {question}\n\n"
        f"Break this into 2-4 focused sub-questions for parallel analysis."
    )

    try:
        raw = _call_gemini_text(SYSTEM_PROMPT, prompt)
        raw = raw.strip()
        # Strip markdown fences
        raw = re.sub(r"```json|```", "", raw).strip()
        subtasks = json.loads(raw)
        if isinstance(subtasks, list) and len(subtasks) >= 2:
            # Clean and limit
            subtasks = [str(s).strip() for s in subtasks if str(s).strip()][:4]
            logger.info("SwarmPlanner: split into %d subtasks", len(subtasks))
            return subtasks
    except Exception as e:
        logger.warning("SwarmPlanner: Gemini split failed (%s), using fallback", e)

    # Fallback: return the original question as a single task
    return [question]