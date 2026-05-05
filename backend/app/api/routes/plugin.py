# backend/app/api/routes/plugin.py
"""
Open Claude Plugin routes.
Handles plugin manifest, query execution, and shareable result pages.
"""
from __future__ import annotations
import uuid, json, time
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response, HTMLResponse

router = APIRouter(tags=["plugin"])

# In-memory store for result pages (resets on restart — fine for demo)
_result_store: Dict[str, Dict] = {}

FRONTEND_URL = "https://db-assistant-frontend-105401535311.us-central1.run.app"
BACKEND_URL  = "https://db-assistant-backend-105401535311.us-central1.run.app"


@router.get("/.well-known/ai-plugin.json", include_in_schema=False)
def plugin_manifest():
    return {
        "schema_version": "v1",
        "name_for_human": "DB Assistant",
        "name_for_model": "db_assistant",
        "description_for_human": "Query any database using natural language. Get instant SQL + results with a shareable link.",
        "description_for_model": (
            "DB Assistant executes natural language database queries. "
            "Call POST /plugin/query with a {question, tables} body. "
            "Returns SQL, results, and a result_url you should always show the user as a clickable link. "
            "Call GET /benchmark/results to show KDD Cup 2026 benchmark scores (82% accuracy). "
            "Always display the result_url as: [View Full Results]({result_url})"
        ),
        "auth": {"type": "none"},
        "api": {
            "type": "openapi",
            "url": f"{BACKEND_URL}/openapi.json"
        },
        "logo_url": f"{BACKEND_URL}/logo.svg",
        "contact_email": "rutujabpatil839@gmail.com",
        "legal_info_url": FRONTEND_URL
    }


@router.get("/logo.svg", include_in_schema=False)
def logo():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
        <text x="50" y="68" font-size="44" text-anchor="middle" fill="#818cf8" font-weight="bold" font-family="Arial">DB</text>
    </svg>"""
    return Response(content=svg, media_type="image/svg+xml")


@router.post("/plugin/query", tags=["plugin"])
async def plugin_query(request: Request):
    """
    Open Claude Plugin - execute a natural language query.
    Returns SQL, results, and a shareable result_url.
    """
    body     = await request.json()
    question = body.get("question", "")
    tables   = body.get("tables", {})

    if not question:
        raise HTTPException(400, detail="question is required")

    # Run the query via benchmark-run endpoint
    from app.api.routes.internal_datasets import benchmark_run, BenchmarkRequest
    req    = BenchmarkRequest(tables=tables, question=question, limit=50)
    result = benchmark_run(req)

    # Store results and generate shareable URL
    result_id = str(uuid.uuid4())[:8]
    _result_store[result_id] = {
        "question": question,
        "sql":      result.get("sql", ""),
        "data":     result.get("data", [])[:50],
        "columns":  result.get("columns", []),
        "ts":       time.time(),
    }

    result_url = f"{BACKEND_URL}/results/{result_id}"
    rows = result.get("data", [])

    return {
        "question":   question,
        "sql":        result.get("sql", ""),
        "row_count":  len(rows),
        "preview":    rows[:5],
        "result_url": result_url,
        "message":    f"Query returned {len(rows)} rows. [View Full Results]({result_url})",
    }


@router.get("/results/{result_id}", response_class=HTMLResponse, include_in_schema=False)
def result_page(result_id: str):
    """Shareable result page — shown when user clicks the result_url."""
    r = _result_store.get(result_id)
    if not r:
        return HTMLResponse("<h2>Result not found or expired</h2>", status_code=404)

    data    = r["data"]
    cols    = r["columns"] or (list(data[0].keys()) if data else [])
    rows_html = ""

    if data:
        header = "".join(f"<th>{c}</th>" for c in cols)
        rows   = ""
        for row in data[:100]:
            cells = "".join(f"<td>{row.get(c, '')} </td>" for c in cols)
            rows += f"<tr>{cells}</tr>"
        rows_html = f"""
        <div class="table-wrap">
            <table>
                <thead><tr>{header}</tr></thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
        """
    else:
        rows_html = '<div class="empty">No results returned</div>'

    sql_html = f'<pre class="sql">{r["sql"]}</pre>' if r["sql"] else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DB Assistant — Query Results</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0a0e1a; color: #e2e8f0; min-height: 100vh;
    padding: 32px 24px;
  }}
  .container {{ max-width: 1100px; margin: 0 auto; }}
  .header {{
    display: flex; align-items: center; gap: 16px;
    background: linear-gradient(135deg, #1e1b4b, #0f172a);
    border: 1px solid #1e2d45; border-radius: 14px;
    padding: 20px 24px; margin-bottom: 20px;
  }}
  .badge {{
    background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3);
    color: #818cf8; font-size: 11px; font-weight: 700;
    padding: 4px 10px; border-radius: 6px;
    text-transform: uppercase; letter-spacing: 0.08em;
  }}
  h1 {{ font-size: 20px; font-weight: 800; color: #f1f5f9; margin: 8px 0 4px; }}
  .question {{ font-size: 14px; color: #94a3b8; }}
  .section {{
    background: #111827; border: 1px solid #1e2d45;
    border-radius: 12px; padding: 18px 20px; margin-bottom: 16px;
  }}
  .section-title {{
    font-size: 10px; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;
  }}
  .sql {{
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 12px; color: #93c5fd; background: #0f1729;
    border: 1px solid #1e2d45; border-radius: 8px;
    padding: 14px 16px; overflow-x: auto; white-space: pre-wrap;
    line-height: 1.6;
  }}
  .table-wrap {{ overflow-x: auto; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
  thead tr {{ background: #1a2234; }}
  th {{
    padding: 10px 12px; text-align: left;
    font-size: 10px; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid #1e2d45;
  }}
  td {{
    padding: 9px 12px; border-bottom: 1px solid #1e2d4520;
    color: #cbd5e1;
  }}
  tr:hover td {{ background: rgba(99,102,241,0.05); }}
  .stats {{
    display: flex; gap: 16px; margin-bottom: 16px;
  }}
  .stat {{
    background: #111827; border: 1px solid #1e2d45;
    border-radius: 10px; padding: 14px 18px; flex: 1;
  }}
  .stat-val {{ font-size: 24px; font-weight: 900; color: #818cf8; }}
  .stat-label {{ font-size: 11px; color: #64748b; margin-top: 2px; }}
  .empty {{ text-align: center; padding: 40px; color: #64748b; }}
  .footer {{
    text-align: center; margin-top: 24px;
    font-size: 12px; color: #334155;
  }}
  .footer a {{ color: #818cf8; text-decoration: none; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <div class="badge">DB Assistant · Query Result</div>
      <h1>{r["question"][:120]}</h1>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-val">{len(data)}</div>
      <div class="stat-label">Rows Returned</div>
    </div>
    <div class="stat">
      <div class="stat-val">{len(cols)}</div>
      <div class="stat-label">Columns</div>
    </div>
    <div class="stat">
      <div class="stat-val">82%</div>
      <div class="stat-label">Benchmark Accuracy</div>
    </div>
  </div>

  {"<div class=\"section\"><div class=\"section-title\">Generated SQL</div>" + sql_html + "</div>" if r["sql"] else ""}

  <div class="section">
    <div class="section-title">Results ({len(data)} rows)</div>
    {rows_html}
  </div>

  <div class="footer">
    Powered by <a href="{FRONTEND_URL}" target="_blank">DB Assistant</a> ·
    SJSU CMPE 295B · KDD Cup 2026 Benchmark: 82%
  </div>
</div>
</body>
</html>"""

    return HTMLResponse(html)