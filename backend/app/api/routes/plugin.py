# backend/app/api/routes/plugin.py
"""
Open Claude Plugin routes.
Supports:
- Demo Neon DB (no setup needed)
- Custom PostgreSQL connection string
- CSV/JSON table upload
"""
from __future__ import annotations
import uuid, json, time
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response, HTMLResponse, JSONResponse

router = APIRouter(tags=["plugin"])

# In-memory store for results and user connections
_result_store: Dict[str, Dict] = {}
_user_sessions: Dict[str, Dict] = {}  # session_id -> {connection_string, tables}

FRONTEND_URL = "https://db-assistant-frontend-105401535311.us-central1.run.app"
BACKEND_URL  = "https://db-assistant-backend-105401535311.us-central1.run.app"

# Demo Neon DB — pre-loaded with employees, departments, orders, sales_performance
DEMO_CONNECTION = "postgresql://neondb_owner:npg_Rn56FbVsmiQI@ep-wandering-art-amtq6t2m-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"


@router.get("/.well-known/ai-plugin.json", include_in_schema=False)
def plugin_manifest():
    return JSONResponse({
        "schema_version": "v1",
        "name_for_human": "DB Assistant",
        "name_for_model": "db_assistant",
        "description_for_human": "Query any database using natural language. Connect your own DB or use demo data.",
        "description_for_model": (
            "DB Assistant executes natural language database queries using Gemini AI. "
            "POST /plugin/query with {question, connection_string?, tables?} to run a query. "
            "POST /plugin/connect with {connection_string, session_id} to save a DB connection. "
            "GET /plugin/demo-tables to see available demo tables. "
            "GET /benchmark/results to show KDD Cup 2026 benchmark scores (82% accuracy). "
            "Always show result_url as a clickable link: [View Full Results](url)"
        ),
        "auth": {"type": "none"},
        "api": {
            "type": "openapi",
            "url": f"{BACKEND_URL}/openapi.json"
        },
        "logo_url": f"{BACKEND_URL}/logo.svg",
        "contact_email": "rutujabpatil839@gmail.com",
        "legal_info_url": FRONTEND_URL
    })


@router.get("/logo.svg", include_in_schema=False)
def logo():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
        <text x="50" y="68" font-size="44" text-anchor="middle" fill="#818cf8" font-weight="bold" font-family="Arial">DB</text>
    </svg>"""
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/plugin/demo-tables", tags=["plugin"])
def demo_tables():
    """List available tables in the demo database."""
    return {
        "database": "Neon PostgreSQL Demo DB",
        "tables": [
            {"name": "employees", "description": "Employee records with name, department, salary, city", "rows": 50},
            {"name": "departments", "description": "Department info with budget and manager", "rows": 10},
            {"name": "orders", "description": "Customer orders with product, quantity, revenue", "rows": 200},
            {"name": "sales_performance", "description": "Sales metrics by region and quarter", "rows": 40},
        ],
        "sample_questions": [
            "How many employees are in each department?",
            "What is the average salary by department?",
            "Which department has the highest budget?",
            "Show me total revenue by product",
            "What are the top 5 orders by revenue?",
        ]
    }


@router.post("/plugin/connect", tags=["plugin"])
async def plugin_connect(request: Request):
    """Save a database connection for this session."""
    body = await request.json()
    connection_string = body.get("connection_string", "")
    session_id = body.get("session_id", str(uuid.uuid4())[:8])

    if not connection_string:
        raise HTTPException(400, detail="connection_string is required")

    # Test the connection
    try:
        import psycopg2
        conn = psycopg2.connect(connection_string)
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 20")
        tables = [row[0] for row in cur.fetchall()]
        conn.close()

        _user_sessions[session_id] = {
            "connection_string": connection_string,
            "tables": tables,
            "connected_at": time.time()
        }

        return {
            "success": True,
            "session_id": session_id,
            "tables_found": tables,
            "message": f"Connected! Found {len(tables)} tables: {', '.join(tables[:5])}{'...' if len(tables) > 5 else ''}",
            "next_step": f"Now ask: /db-assistant:query <your question> --session {session_id}"
        }
    except Exception as e:
        raise HTTPException(400, detail=f"Connection failed: {str(e)}")


@router.post("/plugin/query", tags=["plugin"])
async def plugin_query(request: Request):
    """
    Execute a natural language query.
    Supports: demo DB, custom connection string, or uploaded CSV tables.
    """
    body = await request.json()
    question          = body.get("question", "")
    connection_string = body.get("connection_string", "")
    session_id        = body.get("session_id", "")
    tables            = body.get("tables", {})  # CSV data as {tablename: [{col: val}]}

    if not question:
        raise HTTPException(400, detail="question is required")

    # Determine data source
    if tables:
        # Option 3: CSV/JSON tables uploaded directly
        source = "uploaded_tables"
        from app.api.routes.internal_datasets import benchmark_run, BenchmarkRequest
        req = BenchmarkRequest(tables=tables, question=question, limit=50)
        result = benchmark_run(req)

    elif connection_string or session_id:
        # Option 2: Custom DB connection
        conn_str = connection_string
        if not conn_str and session_id and session_id in _user_sessions:
            conn_str = _user_sessions[session_id]["connection_string"]

        if not conn_str:
            raise HTTPException(400, detail="No connection found for this session_id")

        source = "custom_db"
        result = _run_nl_query_on_pg(question, conn_str)

    else:
        # Option 1: Demo Neon DB (default)
        source = "demo_db"
        result = _run_nl_query_on_pg(question, DEMO_CONNECTION)

    # Store result and generate shareable URL
    result_id = str(uuid.uuid4())[:8]
    _result_store[result_id] = {
        "question": question,
        "sql":      result.get("sql", ""),
        "data":     result.get("data", [])[:100],
        "columns":  result.get("columns", []),
        "source":   source,
        "ts":       time.time(),
    }

    rows = result.get("data", [])
    result_url = f"{BACKEND_URL}/results/{result_id}"
    error = result.get("error", "")

    response_body: Dict[str, Any] = {
        "question":    question,
        "source":      source,
        "sql":         result.get("sql", ""),
        "row_count":   len(rows),
        "preview":     rows[:5],
        "result_url":  result_url,
        "message":     f"Query returned {len(rows)} rows. [View Full Results]({result_url})",
    }
    if error:
        response_body["error"] = error
    return response_body


def _strip_sql(text: str) -> str:
    """Strip markdown code fences from a Gemini SQL response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop first line (```sql or ```) and last line if it's ```
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        text = "\n".join(inner).strip()
    return text


def _run_nl_query_on_pg(question: str, connection_string: str) -> Dict:
    """Run NL query against a PostgreSQL database."""
    import logging
    logger = logging.getLogger("db_assistant.plugin")
    try:
        import psycopg2
        import psycopg2.extras
        import os

        conn = psycopg2.connect(connection_string, cursor_factory=psycopg2.extras.RealDictCursor)
        cur = conn.cursor()

        cur.execute("""
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """)
        schema_rows = cur.fetchall()

        schema: Dict[str, list] = {}
        for row in schema_rows:
            t = row["table_name"]
            if t not in schema:
                schema[t] = []
            schema[t].append(f"{row['column_name']} ({row['data_type']})")

        schema_str = "\n".join(
            f"Table {t}: {', '.join(cols)}" for t, cols in schema.items()
        )

        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = (
            "You are a PostgreSQL expert. Return ONLY a valid SQL query, no explanation, "
            "no markdown fences.\n\n"
            f"Database schema:\n{schema_str}\n\n"
            f"Question: {question}\n\n"
            "Rules:\n"
            "- Return ONLY the SQL query\n"
            "- Use standard PostgreSQL syntax\n"
            "- Add LIMIT 100 unless the question asks for a count or aggregate\n"
            "- No markdown, no code fences, no explanation"
        )
        response = model.generate_content(prompt)
        sql = _strip_sql(response.text)

        cur.execute(sql)
        columns = [desc[0] for desc in cur.description] if cur.description else []
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()

        return {"sql": sql, "data": rows, "columns": columns, "error": ""}

    except Exception as e:
        logger.error("_run_nl_query_on_pg failed: %s", e, exc_info=True)
        return {"sql": "", "data": [], "columns": [], "error": str(e)}


@router.get("/results/{result_id}", response_class=HTMLResponse, include_in_schema=False)
def result_page(result_id: str):
    """Shareable result page."""
    r = _result_store.get(result_id)
    if not r:
        return HTMLResponse("<h2 style='font-family:sans-serif;padding:40px'>Result not found or expired</h2>", status_code=404)

    data = r["data"]
    cols = r["columns"] or (list(data[0].keys()) if data else [])

    source_labels = {
        "demo_db": "Demo Database",
        "custom_db": "Custom Database",
        "uploaded_tables": "Uploaded CSV"
    }
    source_label = source_labels.get(r.get("source", ""), "Database")

    if data:
        header = "".join(f"<th>{c}</th>" for c in cols)
        rows_html = ""
        for row in data[:100]:
            cells = "".join(f"<td>{row.get(c, '')}</td>" for c in cols)
            rows_html += f"<tr>{cells}</tr>"
        table_html = f"""
        <div class="table-wrap">
            <table>
                <thead><tr>{header}</tr></thead>
                <tbody>{rows_html}</tbody>
            </table>
        </div>"""
    else:
        table_html = '<div class="empty">No results returned</div>'

    sql_section = f'<div class="section"><div class="section-title">Generated SQL</div><pre class="sql">{r["sql"]}</pre></div>' if r["sql"] else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DB Assistant — Results</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0a0e1a; color: #e2e8f0; min-height: 100vh; padding: 32px 24px; }}
  .container {{ max-width: 1100px; margin: 0 auto; }}
  .header {{ background: linear-gradient(135deg, #1e1b4b, #0f172a);
    border: 1px solid #1e2d45; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; }}
  .badge {{ background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3);
    color: #818cf8; font-size: 11px; font-weight: 700; padding: 4px 10px;
    border-radius: 6px; text-transform: uppercase; letter-spacing: 0.08em; display: inline-block; margin-bottom: 10px; }}
  h1 {{ font-size: 20px; font-weight: 800; color: #f1f5f9; margin-bottom: 4px; }}
  .source {{ font-size: 12px; color: #94a3b8; }}
  .stats {{ display: flex; gap: 12px; margin-bottom: 16px; }}
  .stat {{ background: #111827; border: 1px solid #1e2d45; border-radius: 10px;
    padding: 14px 18px; flex: 1; }}
  .stat-val {{ font-size: 24px; font-weight: 900; color: #818cf8; }}
  .stat-label {{ font-size: 11px; color: #64748b; margin-top: 2px; }}
  .section {{ background: #111827; border: 1px solid #1e2d45; border-radius: 12px;
    padding: 18px 20px; margin-bottom: 16px; }}
  .section-title {{ font-size: 10px; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }}
  .sql {{ font-family: "JetBrains Mono", monospace; font-size: 12px; color: #93c5fd;
    background: #0f1729; border: 1px solid #1e2d45; border-radius: 8px;
    padding: 14px 16px; overflow-x: auto; white-space: pre-wrap; line-height: 1.6; }}
  .table-wrap {{ overflow-x: auto; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
  thead tr {{ background: #1a2234; }}
  th {{ padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 700;
    color: #64748b; text-transform: uppercase; border-bottom: 1px solid #1e2d45; }}
  td {{ padding: 9px 12px; border-bottom: 1px solid #1e2d4520; color: #cbd5e1; }}
  tr:hover td {{ background: rgba(99,102,241,0.05); }}
  .empty {{ text-align: center; padding: 40px; color: #64748b; }}
  .footer {{ text-align: center; margin-top: 24px; font-size: 12px; color: #334155; }}
  .footer a {{ color: #818cf8; text-decoration: none; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="badge">DB Assistant · {source_label}</div>
    <h1>{r["question"][:120]}</h1>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-val">{len(data)}</div><div class="stat-label">Rows Returned</div></div>
    <div class="stat"><div class="stat-val">{len(cols)}</div><div class="stat-label">Columns</div></div>
    <div class="stat"><div class="stat-val">82%</div><div class="stat-label">KDD Cup Accuracy</div></div>
  </div>
  {sql_section}
  <div class="section">
    <div class="section-title">Results ({len(data)} rows)</div>
    {table_html}
  </div>
  <div class="footer">
    Powered by <a href="{FRONTEND_URL}" target="_blank">DB Assistant</a> ·
    SJSU CMPE 295B · KDD Cup 2026: 82%
  </div>
</div>
</body>
</html>"""
    return HTMLResponse(html)