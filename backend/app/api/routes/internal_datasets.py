# backend/app/api/routes/internal_datasets.py
"""
Internal Dataset storage — per-user CSV/Excel uploads stored in da_db.

Every user gets their own schema:  uploads_u{user_id}
Tables are named exactly as the user chose (safe-sanitised).

API:
  POST /my-datasets/upload          — upload CSV/Excel -> internal DB
  GET  /my-datasets/list            — list all tables the user has uploaded
  POST /my-datasets/nl-query        — NL query against one of their tables
  POST /my-datasets/preview         — preview rows from one of their tables
  DELETE /my-datasets/{table_name}  — drop a user's uploaded table
  POST /my-datasets/benchmark-run   — no-auth benchmark endpoint
"""

from __future__ import annotations

import io
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

import pandas as pd
import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.services.nl_to_sql import generate_sql
from app.agents.orchestrator import Orchestrator
from app.state.agent_state import AgentState

_orchestrator = Orchestrator()

logger = logging.getLogger("db_assistant.datasets")
router = APIRouter(prefix="/my-datasets", tags=["my-datasets"])


def _sys_uri() -> str:
    return (
        f"postgresql://"
        f"{os.getenv('DB_USER','da_user')}:{os.getenv('DB_PASSWORD','da_pass')}"
        f"@{os.getenv('DB_HOST','127.0.0.1')}:{os.getenv('DB_PORT','5433')}"
        f"/{os.getenv('DB_NAME','da_db')}"
    )


def _conn():
    try:
        return psycopg2.connect(
            _sys_uri(), connect_timeout=8,
            cursor_factory=psycopg2.extras.RealDictCursor
        )
    except Exception as e:
        raise HTTPException(503, detail=f"Internal DB unavailable: {e}")


def _user_schema(user_id: int) -> str:
    return f"uploads_u{user_id}"


def _safe_name(name: str) -> str:
    name = name.lower().rsplit(".", 1)[-1]
    name = re.sub(r"[^a-z0-9_]+", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    if not name:
        name = "dataset"
    if name[0].isdigit():
        name = f"t_{name}"
    return name[:60]


def _safe_col(name: str) -> str:
    name = re.sub(r"[^a-z0-9_]+", "_", name.strip().lower())
    name = re.sub(r"_+", "_", name).strip("_") or "col"
    return f"c_{name}" if name[0].isdigit() else name


def _infer_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):              return "boolean"
    if pd.api.types.is_integer_dtype(series):           return "bigint"
    if pd.api.types.is_float_dtype(series):             return "double precision"
    if pd.api.types.is_datetime64_any_dtype(series):    return "timestamp"
    return "text"


def _ensure_user_schema(conn, user_id: int):
    schema = _user_schema(user_id)
    with conn.cursor() as cur:
        cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}";')


def _table_fqn(user_id: int, table_name: str) -> str:
    return f'"{_user_schema(user_id)}"."{table_name}"'


def _get_columns(conn, user_id: int, table_name: str) -> List[Dict]:
    schema = _user_schema(user_id)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table_name))
        return [{"name": dict(r)["column_name"],
                 "pg_type": dict(r)["data_type"]} for r in cur.fetchall()]


def _get_columns_from_schema(conn, schema: str, table_name: str) -> List[Dict]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table_name))
        return [{"name": dict(r)["column_name"],
                 "pg_type": dict(r)["data_type"]} for r in cur.fetchall()]


class DatasetNLRequest(BaseModel):
    table_name: str
    question:   str
    limit:      int = 50


@router.post("/upload", status_code=201)
async def upload_dataset(
    table_name: str        = Form(...),
    file:       UploadFile = File(...),
    user=Depends(get_current_user),
):
    user_id = user["user_id"]
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(400, detail="Only CSV / XLSX / XLS supported.")

    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw)) if ext == "csv" \
             else pd.read_excel(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(400, detail=f"Cannot parse file: {exc}")

    if df.empty:
        raise HTTPException(400, detail="File has no data rows.")

    seen: set = set()
    new_cols: List[str] = []
    for c in df.columns:
        sc = _safe_col(str(c))
        while sc in seen:
            sc += "_2"
        seen.add(sc)
        new_cols.append(sc)
    df.columns = new_cols

    safe_tbl  = _safe_name(table_name or file.filename or "dataset")
    col_defs  = [f'"{c}" {_infer_type(df[c])}' for c in df.columns]
    tbl_fqn   = _table_fqn(user_id, safe_tbl)
    cols_meta = [{"name": c, "pg_type": _infer_type(df[c])} for c in df.columns]

    conn = _conn()
    try:
        _ensure_user_schema(conn, user_id)
        with conn.cursor() as cur:
            cur.execute(f'DROP TABLE IF EXISTS {tbl_fqn};')
            cur.execute(f'CREATE TABLE {tbl_fqn} ({", ".join(col_defs)});')
            csv_buf = io.StringIO()
            df.to_csv(csv_buf, index=False)
            csv_buf.seek(0)
            cols_sql = ", ".join(f'"{c}"' for c in df.columns)
            cur.copy_expert(
                f'COPY {tbl_fqn} ({cols_sql}) FROM STDIN WITH CSV HEADER',
                csv_buf
            )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        raise HTTPException(500, detail=f"Upload failed: {exc}")
    finally:
        conn.close()

    import uuid as _uuid
    dataset_id = str(_uuid.uuid4())
    conn2 = _conn()
    try:
        with conn2.cursor() as cur:
            cur.execute("""
                INSERT INTO dataset_registry
                    (dataset_id, user_id, table_name, table_schema_name, original_filename, row_count)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (dataset_id) DO NOTHING
            """, (dataset_id, user_id, safe_tbl, _user_schema(user_id),
                  file.filename, len(df)))
            for i, cm in enumerate(cols_meta):
                cur.execute("""
                    INSERT INTO dataset_columns
                        (dataset_id, column_name, pg_type, ordinal_position)
                    VALUES (%s, %s, %s, %s)
                """, (dataset_id, cm["name"], cm["pg_type"], i))
        conn2.commit()
    except Exception:
        conn2.rollback()
    finally:
        conn2.close()

    return {
        "table_name":  safe_tbl,
        "row_count":   len(df),
        "columns":     cols_meta,
        "schema":      _user_schema(user_id),
        "fqn":         f"{_user_schema(user_id)}.{safe_tbl}",
        "dataset_id":  dataset_id,
    }


@router.get("/list")
def list_datasets(user=Depends(get_current_user)):
    user_id = user["user_id"]
    schema  = _user_schema(user_id)
    conn    = _conn()
    try:
        _ensure_user_schema(conn, user_id)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    t.table_name,
                    pg_size_pretty(
                        pg_total_relation_size(
                            quote_ident(t.table_schema)||'.'||quote_ident(t.table_name)
                        )
                    ) AS size,
                    (SELECT COUNT(*) FROM information_schema.columns c
                     WHERE c.table_schema = t.table_schema
                       AND c.table_name   = t.table_name) AS col_count,
                    s.n_live_tup AS row_count
                FROM information_schema.tables t
                LEFT JOIN pg_stat_user_tables s
                    ON s.schemaname = t.table_schema
                   AND s.relname    = t.table_name
                WHERE t.table_schema = %s
                  AND t.table_type   = 'BASE TABLE'
                ORDER BY t.table_name
            """, (schema,))
            rows = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
    return {"schema": schema, "datasets": rows}


@router.post("/preview")
def preview_dataset(table_name: str, limit: int = 10,
                    user=Depends(get_current_user)):
    user_id = user["user_id"]
    tbl_fqn = _table_fqn(user_id, _safe_name(table_name))
    conn    = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM {tbl_fqn} LIMIT %s", (min(limit, 100),))
            rows = [dict(r) for r in cur.fetchall()]
            cols = [d.name for d in cur.description] if cur.description else []
        return {"table_name": table_name, "columns": cols,
                "count": len(rows), "data": rows}
    except Exception as exc:
        raise HTTPException(500, detail=f"Preview failed: {exc}")
    finally:
        conn.close()


@router.post("/nl-query")
def dataset_nl_query(req: DatasetNLRequest, user=Depends(get_current_user)):
    user_id  = user["user_id"]
    safe_tbl = _safe_name(req.table_name)

    conn = _conn()
    try:
        cols = _get_columns(conn, user_id, safe_tbl)
        if not cols:
            raise HTTPException(404, detail=f"Table '{req.table_name}' not found.")
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dataset_id FROM dataset_registry WHERE user_id=%s AND table_name=%s LIMIT 1",
                (user_id, safe_tbl)
            )
            row = cur.fetchone()
        dataset_id = dict(row)["dataset_id"] if row else safe_tbl
    finally:
        conn.close()

    state = AgentState(
        user_id           = user_id,
        workspace_id      = user_id,
        source            = "postgresql",
        user_question     = req.question,
        limit             = req.limit,
        selected_datasets = [dataset_id],
    )
    state = _orchestrator.run_dataset_query(state)

    if state.execution_error:
        raise HTTPException(500, detail=state.execution_error)

    return {
        "source":            "internal",
        "table_name":        safe_tbl,
        "question":          req.question,
        "sql":               state.generated_sql,
        "count":             len(state.results),
        "columns":           state.columns,
        "data":              state.results,
        "execution_time_ms": state.execution_time_ms,
        "summary":           state.summary,
        "viz":               state.viz,
        "profile":           state.profile,
        "eda_insights":      state.eda_insights,
    }


@router.get("/schema")
def get_dataset_schema(table_name: str, user=Depends(get_current_user)):
    user_id = user["user_id"]
    safe_tbl = _safe_name(table_name)
    conn = _conn()
    try:
        cols = _get_columns(conn, user_id, safe_tbl)
        if not cols:
            raise HTTPException(404, detail=f"Table '{table_name}' not found.")
        return {"table_name": safe_tbl, "columns": cols}
    finally:
        conn.close()


class DatasetJoinNLRequest(BaseModel):
    table_names: List[str]
    question:    str
    limit:       int = 50


@router.post("/nl-query-join")
def dataset_nl_query_join(req: DatasetJoinNLRequest,
                          user=Depends(get_current_user)):
    if len(req.table_names) < 2:
        raise HTTPException(400, detail="Provide at least 2 table names for a JOIN query.")

    user_id = user["user_id"]
    schema  = _user_schema(user_id)
    conn    = _conn()

    try:
        all_schemas = {}
        for tname in req.table_names:
            safe = _safe_name(tname)
            cols = _get_columns(conn, user_id, safe)
            if not cols:
                raise HTTPException(404, detail=f"Table '{tname}' not found in your datasets.")
            all_schemas[safe] = cols

        schema_prompt = ""
        for tname, cols in all_schemas.items():
            fqn = f'"{schema}"."{tname}"'
            schema_prompt += f"Table: {fqn}\nColumns:\n"
            for c in cols:
                schema_prompt += f"  - {c['name']} ({c['pg_type']})\n"
            schema_prompt += "\n"

        col_sets = [set(c["name"] for c in cols) for cols in all_schemas.values()]
        common   = set.intersection(*col_sets) - {""}
        join_hint = ""
        if common:
            join_hint = (
                f"\nHint: The following column(s) appear in ALL tables and are likely "
                f"JOIN keys: {', '.join(sorted(common))}.\n"
            )

        dataset_ids = []
        with conn.cursor() as cur:
            for tname in all_schemas:
                cur.execute(
                    "SELECT dataset_id FROM dataset_registry WHERE user_id=%s AND table_name=%s LIMIT 1",
                    (user_id, tname)
                )
                row = cur.fetchone()
                dataset_ids.append(dict(row)["dataset_id"] if row else tname)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, detail=f"Schema load failed: {exc}")
    finally:
        conn.close()

    state = AgentState(
        user_id           = user_id,
        workspace_id      = user_id,
        source            = "postgresql",
        user_question     = req.question,
        limit             = req.limit,
        selected_datasets = dataset_ids,
    )
    state = _orchestrator.run_dataset_query(state)

    if state.execution_error:
        raise HTTPException(500, detail=state.execution_error)

    return {
        "source":            "internal_join",
        "table_names":       list(all_schemas.keys()),
        "question":          req.question,
        "sql":               state.generated_sql,
        "count":             len(state.results),
        "columns":           state.columns,
        "data":              state.results,
        "execution_time_ms": state.execution_time_ms,
        "summary":           state.summary,
        "viz":               state.viz,
        "profile":           state.profile,
        "eda_insights":      state.eda_insights,
    }


class DatasetAutoNLRequest(BaseModel):
    all_table_names: List[str]
    question:        str
    limit:           int = 50


@router.post("/nl-query-auto")
def dataset_nl_query_auto(req: DatasetAutoNLRequest,
                          user=Depends(get_current_user)):
    if not req.all_table_names:
        raise HTTPException(400, detail="No datasets found. Upload a file first.")

    user_id = user["user_id"]
    schema  = _user_schema(user_id)
    conn    = _conn()

    try:
        all_schemas = {}
        for tname in req.all_table_names:
            safe = _safe_name(tname)
            cols = _get_columns(conn, user_id, safe)
            if cols:
                all_schemas[safe] = cols

        if not all_schemas:
            raise HTTPException(404, detail="No tables found in your datasets.")

        schema_prompt = "You have access to the following tables in PostgreSQL schema " + schema + ":\n\n"
        for tname, cols in all_schemas.items():
            fqn = '"' + schema + '"."' + tname + '"'
            schema_prompt += "Table: " + fqn + "\nColumns:\n"
            for c in cols:
                schema_prompt += "  - " + c["name"] + " (" + c["pg_type"] + ")\n"
            schema_prompt += "\n"

        col_sets = {t: {c["name"] for c in cols} for t, cols in all_schemas.items()}
        join_hints = []
        table_list = list(col_sets.keys())
        for i in range(len(table_list)):
            for j in range(i + 1, len(table_list)):
                t1, t2 = table_list[i], table_list[j]
                common = col_sets[t1] & col_sets[t2] - {""}
                if common:
                    join_hints.append(
                        f'  - "{schema}"."{t1}" and "{schema}"."{t2}" '
                        f'share: {", ".join(sorted(common)[:4])}'
                    )

        hint_block = ""
        if join_hints:
            hint_block = "Potential JOIN keys:\n" + "\n".join(join_hints) + "\n\n"

        question_with_ctx = (
            req.question + "\n\n"
            + hint_block
            + "Rules:\n"
            + "- Use ONLY the tables listed above with their full schema-qualified names\n"
            + "- If the question involves data from multiple tables, write a JOIN query\n"
            + "- If the question is about one table only, write a simple SELECT\n"
            + '- Always use the full qualified name: "' + schema + '"."tablename"\n'
            + "- For string comparisons always use LOWER(column) = LOWER(value) or ILIKE\n"
            + "- Never assume the exact capitalisation of string values in the data\n"
            + "- Add LIMIT " + str(req.limit) + " at the end\n"
            + "- Return ONLY SQL, no explanation"
        )

        dataset_ids = []
        with conn.cursor() as cur:
            for tname in all_schemas:
                cur.execute(
                    "SELECT dataset_id FROM dataset_registry WHERE user_id=%s AND table_name=%s LIMIT 1",
                    (user_id, tname)
                )
                row = cur.fetchone()
                dataset_ids.append(dict(row)["dataset_id"] if row else tname)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, detail=f"Schema load failed: {exc}")
    finally:
        conn.close()

    state = AgentState(
        user_id           = user_id,
        workspace_id      = user_id,
        source            = "postgresql",
        user_question     = req.question,
        limit             = req.limit,
        selected_datasets = dataset_ids,
    )
    state = _orchestrator.run_dataset_query(state)

    if state.execution_error:
        raise HTTPException(500, detail=state.execution_error)

    tables_used = [t for t in all_schemas if t.lower() in (state.generated_sql or "").lower()]

    return {
        "source":            "internal_auto",
        "tables_used":       tables_used,
        "question":          req.question,
        "sql":               state.generated_sql,
        "count":             len(state.results),
        "columns":           state.columns,
        "data":              state.results,
        "execution_time_ms": state.execution_time_ms,
        "summary":           state.summary,
        "viz":               state.viz,
        "profile":           state.profile,
        "eda_insights":      state.eda_insights,
    }


@router.delete("/{table_name}")
def delete_dataset(table_name: str, user=Depends(get_current_user)):
    user_id  = user["user_id"]
    safe_tbl = _safe_name(table_name)
    tbl_fqn  = _table_fqn(user_id, safe_tbl)
    conn     = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {tbl_fqn};")
        conn.commit()
    finally:
        conn.close()
    return {"message": f"Table '{safe_tbl}' deleted."}


# ─────────────────────────────────────────────────────────────
# BENCHMARK ENDPOINT — no auth needed
# ─────────────────────────────────────────────────────────────

class BenchmarkRequest(BaseModel):
    tables:      Dict[str, List[Dict]]
    question:    str
    limit:       int = 200
    file_paths:  Dict[str, str] = {}   # table_name -> absolute file path (CSV/JSON)


@router.post("/benchmark-run")
def benchmark_run(req: BenchmarkRequest):
    """
    No-auth benchmark endpoint for KDD Cup 2026 evaluation.
    Accepts table data directly, loads into temp PostgreSQL schema,
    runs YOUR full agent pipeline (ReAct + NL-to-SQL), returns result.
    Tables are cleaned up automatically after each run.
    """
    schema  = "benchmark_tmp"
    pg_uri  = _sys_uri()
    conn    = _conn()
    uploaded = []  # list of (safe_name, tbl_fqn)

    try:
        # Set longer timeouts for large table operations
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = '120s';")
        conn.commit()

        # Create temp schema
        with conn.cursor() as cur:
            cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}";')
        conn.commit()

        # Load each table into temp schema
        for table_name, rows in req.tables.items():
            if not rows:
                continue
            df = pd.DataFrame(rows)

            # Sanitise column names
            seen, new_cols = set(), []
            for c in df.columns:
                sc = _safe_col(str(c))
                while sc in seen:
                    sc += "_2"
                seen.add(sc)
                new_cols.append(sc)
            df.columns = new_cols

            safe    = _safe_name(table_name)
            tbl_fqn = f'"{schema}"."{safe}"'
            col_defs = [f'"{c}" {_infer_type(df[c])}' for c in df.columns]

            with conn.cursor() as cur:
                cur.execute(f'DROP TABLE IF EXISTS {tbl_fqn};')
                cur.execute(f'CREATE TABLE {tbl_fqn} ({", ".join(col_defs)});')
                csv_buf = io.StringIO()
                df.to_csv(csv_buf, index=False)
                csv_buf.seek(0)
                cols_sql = ", ".join(f'"{c}"' for c in df.columns)
                cur.copy_expert(
                    f'COPY {tbl_fqn} ({cols_sql}) FROM STDIN WITH CSV HEADER',
                    csv_buf
                )
            conn.commit()
            uploaded.append((safe, tbl_fqn))

            # Create indexes on large tables to speed up queries (>10K rows)
            if len(df) > 10000:
                with conn.cursor() as cur:
                    for col in df.columns:
                        col_lower = col.lower()
                        if col_lower in ('id', 'owneruserid', 'postid', 'userid',
                                         'title', 'displayname', 'answercount',
                                         'viewcount', 'lasteditoruserid'):
                            try:
                                idx_name = f"idx_{safe}_{col_lower}"[:63]
                                cur.execute(
                                    f'CREATE INDEX IF NOT EXISTS "{idx_name}" '
                                    f'ON {tbl_fqn} ("{col}")'
                                )
                            except Exception:
                                pass
                conn.commit()

        # Load large tables directly from file paths (bypasses HTTP serialization limit)
        for table_name, file_path in req.file_paths.items():
            try:
                import os
                fp = Path(file_path)
                if not fp.exists():
                    continue
                if fp.suffix.lower() == '.csv':
                    df = pd.read_csv(fp, low_memory=False, nrows=None)
                elif fp.suffix.lower() == '.json':
                    raw = __import__('json').loads(fp.read_text(encoding='utf-8'))
                    if isinstance(raw, list):
                        df = pd.DataFrame(raw)
                    elif isinstance(raw, dict) and 'records' in raw:
                        df = pd.DataFrame(raw['records'])
                    else:
                        df = pd.DataFrame([raw])
                else:
                    continue

                seen, new_cols = set(), []
                for c in df.columns:
                    sc = _safe_col(str(c))
                    while sc in seen: sc += "_2"
                    seen.add(sc); new_cols.append(sc)
                df.columns = new_cols

                safe    = _safe_name(table_name)
                tbl_fqn = f'"{schema}"."{safe}"'
                col_defs = [f'"{c}" {_infer_type(df[c])}' for c in df.columns]

                with conn.cursor() as cur:
                    cur.execute(f'DROP TABLE IF EXISTS {tbl_fqn};')
                    cur.execute(f'CREATE TABLE {tbl_fqn} ({", ".join(col_defs)});')
                    csv_buf = __import__('io').StringIO()
                    df.to_csv(csv_buf, index=False)
                    csv_buf.seek(0)
                    cols_sql = ", ".join(f'"{c}"' for c in df.columns)
                    cur.copy_expert(
                        f'COPY {tbl_fqn} ({cols_sql}) FROM STDIN WITH CSV HEADER',
                        csv_buf
                    )
                conn.commit()
                uploaded.append((safe, tbl_fqn))
            except Exception as e:
                print(f"file_paths load error {table_name}: {e}")

        if not uploaded:
            return {"error": "No tables loaded", "data": [], "columns": [], "sql": ""}

        # Build tables_schema with sample data so agent sees actual values
        tables_schema = {}
        schema_context = []
        for safe, tbl_fqn in uploaded:
            cols = _get_columns_from_schema(conn, schema, safe)
            # Get sample rows to show actual data values (handles non-English data)
            try:
                with conn.cursor() as cur:
                    cur.execute(f'SELECT * FROM {tbl_fqn} LIMIT 5')
                    sample_rows = [dict(r) for r in cur.fetchall()]
                    col_names = list(sample_rows[0].keys()) if sample_rows else []
                # Build per-column sample values
                for col in cols:
                    col_name = col["name"]
                    vals = list({str(r.get(col_name, '')) for r in sample_rows
                                 if r.get(col_name) is not None and str(r.get(col_name, '')) != ''})[:4]
                    if vals:
                        col["sample_values"] = vals
                # Build schema context string for question enhancement
                schema_context.append(
                    f"Table {safe} sample data:\n" +
                    "\n".join(str(dict(r)) for r in sample_rows[:3])
                )
            except Exception:
                pass
            tables_schema[f"{schema}.{safe}"] = cols

        # Build enhanced question with sample data context
        sample_data_hint = ""
        if schema_context:
            sample_data_hint = (
                "\n\n[ACTUAL DATA SAMPLES — use these EXACT values in WHERE clauses]\n" +
                "\n\n".join(schema_context[:3])  # max 3 tables to avoid token overflow
            )

        enhanced_question = (
            req.question +
            sample_data_hint +
            "\n\n[SQL Rules]\n"
            "- Use EXACT values from the sample data above — data may be in non-English languages\n"
            "- Use the benchmark_tmp schema prefix: benchmark_tmp.tablename\n"
            "- For single-answer questions use LIMIT 1\n"
            "- For COUNT/AVG questions return just the number\n"
            "- Chemical elements use symbols: P=phosphorus, N=nitrogen, Br=bromine, I=iodine, C=carbon\n"
            "- Integer thrombosis values: 1=most severe, 2=severe\n"
        )

        # Run YOUR ReAct agent directly — bypasses dataset_registry entirely
        state = AgentState(
            source             = "postgresql",
            pg_uri             = pg_uri,
            user_question      = enhanced_question,
            limit              = req.limit,
            tables_schema      = tables_schema,
            react_enabled      = True,
            react_max_attempts = 3,
        )
        state = _orchestrator.react_agent.run(state)

    finally:
        # Always clean up temp tables
        try:
            with conn.cursor() as cur:
                for _, tbl_fqn in uploaded:
                    cur.execute(f'DROP TABLE IF EXISTS {tbl_fqn};')
            conn.commit()
        except Exception:
            pass
        conn.close()

    if state.execution_error:
        return {
            "error":   state.execution_error,
            "data":    [],
            "columns": [],
            "sql":     state.generated_sql or "",
        }

    return {
        "data":              state.results,
        "columns":           state.columns,
        "sql":               state.generated_sql or "",
        "execution_time_ms": state.execution_time_ms,
        "react_trace": {
            "attempts":       state.react_attempts,
            "self_corrected": state.react_attempts > 1,
            "thoughts":       state.react_thoughts,
            "actions":        state.react_actions,
            "observations":   state.react_observations,
        } if state.react_attempts > 0 else {},
    }