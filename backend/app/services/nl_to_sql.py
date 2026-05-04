# backend/app/services/nl_to_sql.py

from __future__ import annotations

import os
import re
import json
import time
import logging
from google import genai
from google.genai import errors as genai_errors

logger = logging.getLogger("db_assistant.nl_to_sql")

SYSTEM_PROMPT_SQL = """You are an expert PostgreSQL SQL generator. You write precise, correct SQL.

ABSOLUTE RULES:
- Use ONLY the provided tables and columns — never invent tables or columns
- Do NOT use DELETE, UPDATE, DROP, INSERT, ALTER, CREATE
- Return ONLY SQL. No explanation. No markdown. No comments.
- The SQL MUST start with SELECT
- Always use fully qualified table names: schema.tablename

SQL QUALITY RULES:
- For "which X has the lowest/highest/best/worst": use ORDER BY col ASC/DESC LIMIT 1
- For "how many": use COUNT(*) or COUNT(DISTINCT col) — return a single number
- For "average monthly": divide yearly AVG by 12 — use SUM(col)/COUNT(DISTINCT month_col) or AVG(col)/12
- For "percentage": use CAST(numerator AS REAL) * 100.0 / denominator
- For "list all X": use SELECT DISTINCT to avoid duplicates
- For questions asking for ONE answer (who/which/what is THE): add LIMIT 1
- For ratio questions (X compared to Y): use subqueries or CASE WHEN
- For JOIN queries: always specify ON conditions explicitly
- When a column stores IDs/keys (link_to_X, X_id): JOIN to the lookup table to get the actual name

COMMON MISTAKES TO AVOID:
- Never use 'phosphorus', 'bromine', 'nitrogen' etc — element column stores SYMBOLS: P, Br, N, I, C, O, S, Cl
- Never use English translations for non-English data — use exact values from sample data
- Never use string comparison for integer columns — thrombosis stores integers (1, 2, 3)
- Never select link_to_major when asked for major name — JOIN to major table
- For attendance/event joins: use event_id foreign key, not event name
- When counting distinct items in a subquery: use GROUP BY + HAVING, then COUNT the outer result
- For budget ratio questions: use SUM(CASE WHEN event='X' THEN amount ELSE 0 END) / SUM(CASE WHEN event='Y' THEN amount ELSE 0 END)
- For "most/least X": use ORDER BY + LIMIT 1, not subquery
- Never write WHERE 1=0 or SELECT NULL — always write real SQL
- For hasContentWarning column: it stores INTEGER 0 or 1, not boolean 'true'/'false'
- CRITICAL: In SQL LIKE, underscore '_' is a wildcard matching any single character
  When matching literal underscores (e.g. atom_id like 'TR001_4'), NEVER use bare LIKE
  Instead use string concatenation: atom_id = molecule_id || '_4'
  Or escape: atom_id LIKE '%[_]4' or use ESCAPE clause
- For CTE/multi-step calculations: use WITH clause CTEs with LIMIT 1 on each subquery
- For race position calculations: use positionorder column, filter milliseconds IS NOT NULL
- CRITICAL: SQL LIKE underscore _ matches ANY single character. To match literal '_4' suffix use: col = other_col || '_4' OR use LIKE '%\_4' ESCAPE '\\'. Never use bare LIKE '%_4' for atom IDs
- For champion vs last place percentage: use WITH CTEs, each with LIMIT 1 to avoid multiple row errors. Formula: (last_ms - champ_ms) * 100.0 / last_ms
"""

SYSTEM_PROMPT_JSON = """You are a JSON generator.
Rules:
- Return ONLY valid JSON. No SQL. No markdown. No extra text.
- The output MUST be parseable by json.loads().
"""

# Retry config for 429 rate limit errors
_MAX_RETRIES  = 3
_RETRY_DELAYS = [5, 15, 30]  # seconds between retries


def assert_safe_select(sql: str) -> None:
    s = sql.strip().lower()
    # Allow CTEs (WITH ... SELECT) in addition to plain SELECT
    if not s.startswith("select") and not s.startswith("with"):
        raise ValueError("Only SELECT queries are allowed.")
    banned = ["delete", "update", "drop", "alter", "truncate",
              "insert", "create", "grant", "revoke"]
    if any(re.search(rf"\b{b}\b", s) for b in banned):
        raise ValueError("Unsafe SQL detected.")


def _extract_sql(text: str) -> str:
    """Extract first SELECT ... statement from model output."""
    text = (text or "").strip()
    text = re.sub(r"```sql", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)
    text = text.strip()

    # Fix missing WITH keyword for CTEs
    # Gemini sometimes generates "champion AS (SELECT...) SELECT..." without WITH
    cte_pattern = re.search(r'^\s*\w+\s+AS\s*\(', text, re.IGNORECASE | re.MULTILINE)
    if cte_pattern and not re.search(r'^\s*WITH\b', text, re.IGNORECASE | re.MULTILINE):
        text = 'WITH ' + text.strip()

    match = re.search(r"\bSELECT\b", text, re.IGNORECASE)
    if not match:
        # Check for WITH CTE
        with_match = re.search(r"\bWITH\b", text, re.IGNORECASE)
        if with_match:
            sql = text[with_match.start():].strip().rstrip(";").strip()
            return sql
        raise ValueError(f"No SELECT statement found in model output. Raw: {text[:300]}")

    sql = text[match.start():].strip().rstrip(";").strip()
    # If SQL starts with SELECT but there's a WITH CTE before it, include the WITH
    with_match = re.search(r"\bWITH\b", text, re.IGNORECASE)
    if with_match and with_match.start() < match.start():
        sql = text[with_match.start():].strip().rstrip(";").strip()
    return sql


def _extract_first_json_object(text: str) -> str:
    s = (text or "").strip()
    s = re.sub(r"```json|```", "", s, flags=re.IGNORECASE).strip()

    if not s:
        raise ValueError("Empty model output (expected JSON).")

    try:
        obj = json.loads(s)
        if isinstance(obj, dict):
            return s
    except Exception:
        pass

    start = s.find("{")
    if start == -1:
        raise ValueError(f"No '{{' found in model output. Raw: {s[:300]}")

    depth = 0
    in_str = False
    escape = False

    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = s[start: i + 1]
                try:
                    obj = json.loads(candidate)
                except Exception as e:
                    raise ValueError(f"Invalid JSON extracted: {e}. Raw: {candidate[:300]}")
                if not isinstance(obj, dict):
                    raise ValueError("Extracted JSON was not an object.")
                return candidate

    raise ValueError(f"Unbalanced JSON braces in model output. Raw: {s[:300]}")


def _is_rate_limit_error(e: Exception) -> bool:
    """Check if error is a 429 rate limit / resource exhausted error."""
    msg = str(e).lower()
    return "429" in msg or "resource_exhausted" in msg or "resource exhausted" in msg


def _call_gemini_text(system_prompt: str, user_prompt: str) -> str:
    """
    Shared Gemini call with automatic retry on 429 rate limit errors.
    Retries up to 3 times with increasing delays: 5s, 15s, 30s.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    last_error = None

    for attempt in range(_MAX_RETRIES):
        try:
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[system_prompt, user_prompt],
            )
            return (resp.text or "").strip()

        except genai_errors.ClientError as e:
            if _is_rate_limit_error(e) and attempt < _MAX_RETRIES - 1:
                delay = _RETRY_DELAYS[attempt]
                logger.warning(
                    "Gemini 429 rate limit hit (attempt %d/%d). "
                    "Retrying in %ds...", attempt + 1, _MAX_RETRIES, delay
                )
                time.sleep(delay)
                last_error = e
                continue
            raise RuntimeError(f"Gemini API error: {e}")

        except Exception as e:
            if _is_rate_limit_error(e) and attempt < _MAX_RETRIES - 1:
                delay = _RETRY_DELAYS[attempt]
                logger.warning(
                    "Gemini rate limit hit (attempt %d/%d). "
                    "Retrying in %ds...", attempt + 1, _MAX_RETRIES, delay
                )
                time.sleep(delay)
                last_error = e
                continue
            raise RuntimeError(f"Gemini call failed: {e}")

    raise RuntimeError(
        f"Gemini rate limit: all {_MAX_RETRIES} retries exhausted. "
        f"Please wait a minute and try again. Last error: {last_error}"
    )


def generate_sql(schema_prompt: str, user_question: str) -> str:
    prompt = f"""{schema_prompt}

User Question:
{user_question}

Return ONLY SQL:
"""
    raw_text = _call_gemini_text(SYSTEM_PROMPT_SQL, prompt)
    sql = _extract_sql(raw_text)
    assert_safe_select(sql)
    return sql


def generate_json(schema_prompt: str, user_question: str) -> str:
    """
    Gemini call for Mongo query generation.
    Returns raw LLM text so MongoQueryAgent can parse it itself.
    """
    prompt = f"""{schema_prompt}

USER_QUESTION:
{user_question}

Return ONLY valid JSON:
"""
    raw_text = _call_gemini_text(SYSTEM_PROMPT_JSON, prompt)
    return raw_text