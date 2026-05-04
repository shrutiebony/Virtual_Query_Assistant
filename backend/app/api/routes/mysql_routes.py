import time
import traceback
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services.mysql_service import (
    get_mysql_tables,
    get_mysql_schema,
    generate_mysql_sql,
    execute_mysql_query,
    get_mysql_connection
)
from app.api.routes.auth import get_current_user

logger = logging.getLogger("db_assistant.mysql")
router = APIRouter(prefix="/mysql", tags=["mysql"])


# ── Request Models ─────────────────────────────────────────────────────────

class MySQLConnectionParams(BaseModel):
    host: str
    port: int = 3306
    database: str
    username: str
    password: str


class MySQLNLQueryRequest(BaseModel):
    host: str
    port: int = 3306
    database: str
    username: str
    password: str
    question: str
    tables: List[str]


class MySQLTestConnectionRequest(BaseModel):
    host: str
    port: int = 3306
    database: str
    username: str
    password: str


# ── EDA Helper ─────────────────────────────────────────────────────────────

def _build_eda_profile(results: list, columns: list) -> dict:
    """Build EDA profile from MySQL query results."""
    if not results or not columns:
        return {}

    col_profiles = []

    for col in columns:
        values = [row[col] for row in results if row.get(col) is not None]
        null_count = sum(1 for row in results if row.get(col) is None)
        null_pct = (null_count / len(results) * 100) if results else 0

        # Detect numeric columns
        numeric_vals = []
        for v in values:
            try:
                numeric_vals.append(float(v))
            except (ValueError, TypeError):
                pass

        if len(numeric_vals) >= len(values) * 0.8 and numeric_vals:
            col_profiles.append({
                "name": col,
                "type": "numeric",
                "min": round(min(numeric_vals), 2),
                "max": round(max(numeric_vals), 2),
                "mean": round(sum(numeric_vals) / len(numeric_vals), 2),
                "null_pct": round(null_pct, 1),
            })
        else:
            # Categorical — get top values
            from collections import Counter
            str_values = [str(v) for v in values]
            top = Counter(str_values).most_common(5)
            col_profiles.append({
                "name": col,
                "type": "categorical",
                "top_values": [[v, str(c)] for v, c in top],
                "null_pct": round(null_pct, 1),
                "unique_count": len(set(str_values)),
            })

    return {"columns": col_profiles}


def _build_eda_insights(results: list, columns: list, question: str) -> dict:
    """Build basic EDA insights without Gemini."""
    if not results:
        return {}

    row_count = len(results)
    col_count = len(columns)

    # Build key findings
    key_findings = [
        f"Query returned {row_count} row{'s' if row_count != 1 else ''} across {col_count} column{'s' if col_count != 1 else ''}.",
    ]

    # Find numeric columns and their stats
    for col in columns:
        numeric_vals = []
        for row in results:
            try:
                numeric_vals.append(float(row[col]))
            except (ValueError, TypeError):
                pass

        if len(numeric_vals) >= len(results) * 0.8 and numeric_vals:
            key_findings.append(
                f"{col}: min={round(min(numeric_vals), 2)}, max={round(max(numeric_vals), 2)}, avg={round(sum(numeric_vals)/len(numeric_vals), 2)}."
            )

    # Data quality score
    null_counts = sum(
        1 for row in results for val in row.values() if val is None
    )
    total_cells = row_count * col_count
    null_pct = (null_counts / total_cells * 100) if total_cells else 0
    quality_score = max(0, int(100 - null_pct * 2))

    return {
        "headline": f"MySQL query returned {row_count} rows for: {question}",
        "key_findings": key_findings[:5],
        "data_quality": {
            "score": quality_score,
            "verdict": "Good" if quality_score >= 70 else "Needs attention",
            "issues": [f"{round(null_pct, 1)}% null values detected"] if null_pct > 5 else [],
        },
        "recommendations": [
            "Use the Charts tab to visualize numeric columns.",
            "Use AI Functions to enrich results with Gemini insights.",
        ],
    }


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/test-connection")
def test_mysql_connection(
    req: MySQLTestConnectionRequest,
    user=Depends(get_current_user)
):
    try:
        conn = get_mysql_connection(
            req.host, req.port, req.database,
            req.username, req.password
        )
        conn.close()
        return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/list-tables")
def list_mysql_tables(
    req: MySQLConnectionParams,
    user=Depends(get_current_user)
):
    try:
        tables = get_mysql_tables(
            req.host, req.port, req.database,
            req.username, req.password
        )
        return {"tables": tables, "database": req.database}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/get-schema")
def get_schema(
    req: MySQLNLQueryRequest,
    user=Depends(get_current_user)
):
    try:
        schema = get_mysql_schema(
            req.host, req.port, req.database,
            req.username, req.password, req.tables
        )
        return {"schema": schema, "tables": req.tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/nl-query")
def mysql_nl_query(
    req: MySQLNLQueryRequest,
    user=Depends(get_current_user)
):
    try:
        # Step 1 — fetch schema
        schema_prompt = get_mysql_schema(
            req.host, req.port, req.database,
            req.username, req.password, req.tables
        )

        # Step 2 — generate SQL
        start = time.time()
        sql = generate_mysql_sql(schema_prompt, req.question)
        logger.info(f"Generated MySQL SQL: {sql}")

        # Step 3 — execute query
        results = execute_mysql_query(
            req.host, req.port, req.database,
            req.username, req.password, sql
        )
        elapsed = int((time.time() - start) * 1000)

        # Step 4 — build columns
        columns = list(results[0].keys()) if results else []

        # Step 5 — build EDA profile and insights
        profile      = _build_eda_profile(results, columns)
        eda_insights = _build_eda_insights(results, columns, req.question)

        return {
            "data":             results,
            "sql":              sql,
            "columns":          columns,
            "row_count":        len(results),
            "execution_time_ms": elapsed,
            "tables_used":      req.tables,
            "database":         req.database,
            "profile":          profile,
            "eda_insights":     eda_insights,
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nl-query-join")
def mysql_nl_query_join(
    req: MySQLNLQueryRequest,
    user=Depends(get_current_user)
):
    try:
        schema_prompt = get_mysql_schema(
            req.host, req.port, req.database,
            req.username, req.password, req.tables
        )

        join_hint = (
            "\n\nNote: The user has selected multiple tables. "
            "Use appropriate JOIN clauses based on foreign key relationships visible in the schema. "
            "Infer join conditions from column name similarities such as customer_id matching id."
        )
        schema_prompt += join_hint

        start = time.time()
        sql = generate_mysql_sql(schema_prompt, req.question)
        results = execute_mysql_query(
            req.host, req.port, req.database,
            req.username, req.password, sql
        )
        elapsed = int((time.time() - start) * 1000)
        columns = list(results[0].keys()) if results else []

        # Build EDA profile and insights
        profile      = _build_eda_profile(results, columns)
        eda_insights = _build_eda_insights(results, columns, req.question)

        return {
            "data":             results,
            "sql":              sql,
            "columns":          columns,
            "row_count":        len(results),
            "execution_time_ms": elapsed,
            "tables_used":      req.tables,
            "database":         req.database,
            "profile":          profile,
            "eda_insights":     eda_insights,
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/show-indexes")
def show_mysql_indexes(
    req: MySQLNLQueryRequest,
    user=Depends(get_current_user)
):
    try:
        conn = get_mysql_connection(
            req.host, req.port, req.database,
            req.username, req.password
        )
        cursor = conn.cursor(dictionary=True)
        all_indexes = {}
        for table in req.tables:
            cursor.execute(f"SHOW INDEX FROM `{table}`")
            all_indexes[table] = cursor.fetchall()
        conn.close()
        return {"indexes": all_indexes}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/show-create-table")
def show_create_table(
    req: MySQLNLQueryRequest,
    user=Depends(get_current_user)
):
    try:
        conn = get_mysql_connection(
            req.host, req.port, req.database,
            req.username, req.password
        )
        cursor = conn.cursor()
        create_statements = {}
        for table in req.tables:
            cursor.execute(f"SHOW CREATE TABLE `{table}`")
            row = cursor.fetchone()
            create_statements[table] = row[1] if row else ""
        conn.close()
        return {"create_statements": create_statements}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))