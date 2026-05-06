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


def _esc(s: str) -> str:
    return str(s).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")


_RESULT_PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DB Assistant — Results</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#0a0e1a;color:#e2e8f0;font-family:'DM Sans',-apple-system,sans-serif;min-height:100vh;line-height:1.5}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:3px}

/* Header */
.ph{background:rgba(10,14,26,0.95);border-bottom:1px solid #1e2d45;padding:0;position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.phi{max-width:1200px;margin:0 auto;padding:14px 28px;display:flex;align-items:center;gap:14px}
.phlogo{width:34px;height:34px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 0 14px rgba(99,102,241,0.4)}
.phbrand{font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);white-space:nowrap}
.phsep{color:#1e2d45;font-size:16px;margin:0 2px}
.phq{font-size:12px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.srcbadge{flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:3px 10px;border-radius:20px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#818cf8}
.copybtn{flex-shrink:0;display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#475569;background:rgba(255,255,255,.04);border:1px solid #1e2d45;border-radius:7px;padding:5px 11px;cursor:pointer;transition:all .15s;font-family:inherit}
.copybtn:hover{background:rgba(255,255,255,.08);color:#94a3b8}
.copybtn.ok{color:#10b981;border-color:rgba(16,185,129,.3)}

/* Main */
.main{max-width:1200px;margin:0 auto;padding:28px 28px 48px}

/* Hero */
.qhero{background:linear-gradient(135deg,#111827,#0f1520);border:1px solid #1e2d45;border-radius:14px;padding:26px 30px;margin-bottom:18px;position:relative;overflow:hidden}
.qhero::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:32px 32px;pointer-events:none}
.qhero::after{content:'';position:absolute;top:-60px;right:-60px;width:260px;height:260px;background:radial-gradient(circle,rgba(99,102,241,.14) 0%,transparent 65%);pointer-events:none}
.qlabel{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#818cf8;margin-bottom:8px;position:relative;z-index:1}
.qtext{font-size:1.35rem;font-weight:700;color:#f1f5f9;line-height:1.35;position:relative;z-index:1}

/* Stats */
.statsrow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.scard{background:#111827;border:1px solid #1e2d45;border-radius:10px;padding:16px 18px}
.scval{font-size:1.75rem;font-weight:800;color:#818cf8;line-height:1;margin-bottom:5px}
.scval.green{font-size:.85rem;font-weight:600;color:#10b981;display:flex;align-items:center;gap:5px;margin-top:6px}
.sclabel{font-size:.67rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#334155}

/* Cards */
.sc{background:#111827;border:1px solid #1e2d45;border-radius:12px;overflow:hidden;margin-bottom:18px}
.sch{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid #1e2d45;background:#0f1520}
.scht{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#334155}
.schact{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#818cf8;background:none;border:none;cursor:pointer;font-family:inherit;padding:3px 8px;border-radius:5px;transition:all .15s}
.schact:hover{background:rgba(99,102,241,.12)}
.schact.ok{color:#10b981}

/* SQL */
pre.sqlpre{padding:16px 20px;font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.8;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.skw{color:#c084fc;font-weight:600}
.sfn{color:#67e8f9}
.sstr{color:#86efac}
.snum{color:#fbbf24}
.sdef{color:#93c5fd}

/* Chart */
.chartpad{padding:20px}
.chartwrap{position:relative;height:300px}
.chartmeta{display:flex;align-items:center;gap:8px}
.chartbadge{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#334155;background:rgba(255,255,255,.04);border:1px solid #1e2d45;border-radius:4px;padding:2px 8px}

/* Table */
.twrap{overflow-x:auto}
table.rt{width:100%;border-collapse:collapse;font-size:12.5px}
table.rt thead tr{background:#0f1520;border-bottom:1px solid #1e2d45}
table.rt th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#334155;cursor:pointer;user-select:none;white-space:nowrap;transition:color .15s}
table.rt th:hover{color:#818cf8}
table.rt th.srt{color:#818cf8}
table.rt tbody tr{border-bottom:1px solid rgba(30,45,69,.45);transition:background .1s}
table.rt tbody tr:hover{background:rgba(99,102,241,.05)}
table.rt td{padding:9px 14px;color:#94a3b8;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
table.rt td.num{color:#c4b5fd;font-family:'JetBrains Mono',monospace;font-size:12px}
table.rt td.rn{color:#1e2d45;font-size:11px;font-family:'JetBrains Mono',monospace;width:44px;text-align:right;padding-right:8px}
.tfoot{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid #1e2d45;background:#0f1520;font-size:11px;color:#334155}

/* Footer */
.pfooter{border-top:1px solid #1e2d45;margin-top:8px;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#1e2d45;max-width:1200px;margin-left:auto;margin-right:auto}
.pfooter a{color:#334155;text-decoration:none;transition:color .15s}
.pfooter a:hover{color:#818cf8}

@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fu{animation:fadeUp .35s ease forwards}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:768px){
  .main{padding:16px 14px 40px}
  .statsrow{grid-template-columns:repeat(2,1fr)}
  .phq{display:none}
  .qtext{font-size:1.1rem}
}
</style>
</head>
<body>

<div class="ph">
  <div class="phi">
    <div class="phlogo">DB</div>
    <span class="phbrand">DB Assistant</span>
    <span class="phsep">/</span>
    <span class="phq">TMPL_QUESTION</span>
    <span class="srcbadge">TMPL_SOURCE</span>
    <button class="copybtn" id="cbtn" onclick="copyURL()">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Share
    </button>
  </div>
</div>

<div class="main">

  <div class="qhero fu">
    <div class="qlabel">Natural Language Query</div>
    <div class="qtext">TMPL_QUESTION</div>
  </div>

  <div class="statsrow fu" style="animation-delay:.05s">
    <div class="scard"><div class="scval">TMPL_ROWS</div><div class="sclabel">Rows returned</div></div>
    <div class="scard"><div class="scval">TMPL_COLS</div><div class="sclabel">Columns</div></div>
    <div class="scard"><div class="scval" style="font-size:.9rem;font-weight:600;color:#94a3b8;margin-top:4px">TMPL_SOURCE</div><div class="sclabel">Data source</div></div>
    <div class="scard">
      <div class="scval green">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Success
      </div>
      <div class="sclabel">Query status</div>
    </div>
  </div>

  TMPL_SQL_SECTION

  <div class="sc fu" style="animation-delay:.15s" id="chartcard">
    <div class="sch">
      <span class="scht">Data Visualization</span>
      <div class="chartmeta">
        <span class="chartbadge" id="chartbadge"></span>
      </div>
    </div>
    <div class="chartpad">
      <div id="chartwrap" style="width:100%"></div>
    </div>
  </div>

  <div class="sc fu" style="animation-delay:.2s">
    <div class="sch">
      <span class="scht">Results — TMPL_ROWS rows</span>
      <button class="schact" id="expbtn" onclick="exportCSV()">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export CSV
      </button>
    </div>
    <div class="twrap"><table class="rt"><thead id="thead"></thead><tbody id="tbody"></tbody></table></div>
    <div class="tfoot"><span id="tinfo"></span><span style="color:#1e2d45">Click column header to sort</span></div>
  </div>

</div>

<div class="pfooter">
  <span>Powered by <a href="TMPL_FRONTEND" target="_blank">DB Assistant</a> &middot; SJSU CMPE 295B</span>
  <span style="display:flex;gap:16px"><a href="TMPL_FRONTEND" target="_blank">Dashboard</a><a href="https://github.com/rutuja-patil24/database-assistant" target="_blank">GitHub</a></span>
</div>

<script>
const DATA = TMPL_DATA_JSON;
const COLS = TMPL_COLS_JSON;

function isNum(v){return v!==null&&v!==''&&!isNaN(parseFloat(v))&&isFinite(v)}
function isDate(c){return /date|time|year|month|quarter|week|day/i.test(c)}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function fmt(v){if(v===null||v===undefined)return '<span style="color:#1e2d45">null</span>';if(isNum(v)){const n=parseFloat(v);return Number.isInteger(n)?n.toLocaleString():n.toLocaleString(undefined,{maximumFractionDigits:4})}return esc(String(v))}

/* ── Chart (pure SVG — no CDN) ── */
const COLORS=['#818cf8','#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#38bdf8','#c084fc'];

function fmtN(v){
  const n=parseFloat(v);
  if(isNaN(n))return String(v??'');
  if(Math.abs(n)>=1e9)return(n/1e9).toFixed(1)+'B';
  if(Math.abs(n)>=1e6)return(n/1e6).toFixed(1)+'M';
  if(Math.abs(n)>=1e3)return(n/1e3).toFixed(1)+'k';
  return n%1===0?n.toLocaleString():n.toLocaleString(undefined,{maximumFractionDigits:2});
}

function buildHBarSVG(labels,values){
  const maxV=Math.max(...values,1);
  const barH=30,gap=8;
  const maxLabelLen=Math.max(...labels.map(l=>l.length));
  const lw=Math.min(160,Math.max(60,maxLabelLen*6.8+12));
  const svgW=700,rpad=80;
  const bW=svgW-lw-rpad-12;
  const svgH=labels.length*(barH+gap)+16;
  const rows=labels.map((lb,i)=>{
    const bw=Math.max(4,(values[i]/maxV)*bW);
    const y=i*(barH+gap)+8;
    const c=COLORS[i%COLORS.length];
    const sl=lb.length>22?lb.slice(0,20)+'…':lb;
    return '<text x="'+(lw-8)+'" y="'+(y+barH/2+4.5)+'" text-anchor="end" font-size="12" fill="#475569" font-family="DM Sans,sans-serif">'+esc(sl)+'</text>'
      +'<rect x="'+lw+'" y="'+y+'" width="'+bW+'" height="'+barH+'" rx="3" fill="rgba(30,45,69,.4)"/>'
      +'<rect x="'+lw+'" y="'+y+'" width="'+bw+'" height="'+barH+'" rx="3" fill="'+c+'"/>'
      +'<text x="'+(lw+bw+7)+'" y="'+(y+barH/2+4.5)+'" font-size="11" fill="#94a3b8" font-family="DM Sans,sans-serif">'+fmtN(values[i])+'</text>';
  }).join('');
  return '<svg viewBox="0 0 '+svgW+' '+svgH+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">'+rows+'</svg>';
}

function buildVBarSVG(labels,values){
  const maxV=Math.max(...values,1);
  const svgW=700,svgH=280;
  const pT=20,pB=50,pL=55,pR=20;
  const cW=svgW-pL-pR,cH=svgH-pT-pB;
  const bw=Math.min(72,(cW/labels.length)*.72);
  const bGap=(cW-bw*labels.length)/(labels.length+1);
  const yTicks=5;
  let grid='';
  for(let i=0;i<=yTicks;i++){
    const y=pT+cH*(1-i/yTicks);
    const val=maxV*i/yTicks;
    grid+='<line x1="'+pL+'" y1="'+y+'" x2="'+(pL+cW)+'" y2="'+y+'" stroke="#1e2d45" stroke-width="1"/>'
      +'<text x="'+(pL-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#334155" font-family="DM Sans,sans-serif">'+fmtN(val)+'</text>';
  }
  const bars=labels.map((lb,i)=>{
    const bh=Math.max(2,(values[i]/maxV)*cH);
    const x=pL+bGap+i*(bw+bGap);
    const y=pT+cH-bh;
    const c=COLORS[i%COLORS.length];
    const sl=lb.length>10?lb.slice(0,9)+'…':lb;
    return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="4" fill="'+c+'"/>'
      +'<text x="'+(x+bw/2)+'" y="'+(y-5)+'" text-anchor="middle" font-size="10" fill="#64748b" font-family="DM Sans,sans-serif">'+fmtN(values[i])+'</text>'
      +'<text x="'+(x+bw/2)+'" y="'+(pT+cH+16)+'" text-anchor="middle" font-size="11" fill="#475569" font-family="DM Sans,sans-serif">'+esc(sl)+'</text>';
  }).join('');
  return '<svg viewBox="0 0 '+svgW+' '+svgH+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">'+grid+bars+'</svg>';
}

function buildLineSVG(labels,values){
  const maxV=Math.max(...values,1),minV=Math.min(...values,0);
  const range=maxV-minV||1;
  const svgW=700,svgH=260;
  const pT=20,pB=45,pL=55,pR=20;
  const cW=svgW-pL-pR,cH=svgH-pT-pB;
  const xs=labels.map((_,i)=>pL+(labels.length<2?cW/2:i*(cW/(labels.length-1))));
  const ys=values.map(v=>pT+cH-(((v-minV)/range)*cH));
  const yTicks=5;
  let grid='';
  for(let i=0;i<=yTicks;i++){
    const y=pT+cH*(1-i/yTicks);
    const val=minV+range*i/yTicks;
    grid+='<line x1="'+pL+'" y1="'+y+'" x2="'+(pL+cW)+'" y2="'+y+'" stroke="#1e2d45" stroke-width="1"/>'
      +'<text x="'+(pL-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#334155" font-family="DM Sans,sans-serif">'+fmtN(val)+'</text>';
  }
  const fillPath='M'+pL+' '+(pT+cH)+' L'+xs.map((x,i)=>x+' '+ys[i]).join(' L')+' L'+xs[xs.length-1]+' '+(pT+cH)+' Z';
  const linePath='M'+xs.map((x,i)=>x+' '+ys[i]).join(' L');
  let ticks='';
  const step=Math.max(1,Math.ceil(labels.length/12));
  for(let i=0;i<labels.length;i+=step){
    const sl=labels[i].length>10?labels[i].slice(0,9)+'…':labels[i];
    ticks+='<text x="'+xs[i]+'" y="'+(pT+cH+16)+'" text-anchor="middle" font-size="10" fill="#475569" font-family="DM Sans,sans-serif">'+esc(sl)+'</text>';
  }
  const dots=xs.map((x,i)=>'<circle cx="'+x+'" cy="'+ys[i]+'" r="3.5" fill="#818cf8" stroke="#0a0e1a" stroke-width="2"/>').join('');
  return '<svg viewBox="0 0 '+svgW+' '+svgH+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">'
    +'<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity=".2"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs>'
    +grid
    +'<path d="'+fillPath+'" fill="url(#lg)"/>'
    +'<path d="'+linePath+'" fill="none" stroke="#818cf8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
    +dots+ticks
    +'</svg>';
}

function buildChart(){
  if(!DATA.length){document.getElementById('chartcard').style.display='none';return}
  const numCols=COLS.filter(c=>DATA.every(r=>isNum(r[c])));
  const catCols=COLS.filter(c=>!numCols.includes(c));
  if(!numCols.length){document.getElementById('chartcard').style.display='none';return}
  const labelCol=catCols[0]||null;
  const values=DATA.map(r=>parseFloat(r[numCols[0]])||0);
  const labels=labelCol?DATA.map(r=>String(r[labelCol]??'')):DATA.map((_,i)=>String(i+1));
  const useLine=Boolean(labelCol&&isDate(labelCol))||DATA.length>15;
  document.getElementById('chartbadge').textContent=(useLine?'Line':'Bar')+' chart';
  const wrap=document.getElementById('chartwrap');
  if(useLine) wrap.innerHTML=buildLineSVG(labels,values);
  else if(DATA.length<=8) wrap.innerHTML=buildVBarSVG(labels,values);
  else wrap.innerHTML=buildHBarSVG(labels,values);
}

/* ── Table ── */
let sortCol=null,sortAsc=true;
function buildTable(rows){
  const r=rows||DATA;
  const numCols=new Set(COLS.filter(c=>r.every(row=>isNum(row[c]))));
  document.getElementById('thead').innerHTML=
    '<tr><th style="cursor:default;width:44px;color:#1e2d45">#</th>'+
    COLS.map(c=>`<th onclick="sortBy('${c}')" class="${sortCol===c?'srt':''}">${esc(c)} <span style="opacity:.4">${sortCol===c?(sortAsc?'▲':'▼'):'↕'}</span></th>`).join('')+
    '</tr>';
  document.getElementById('tbody').innerHTML=
    r.map((row,i)=>'<tr><td class="rn">'+(i+1)+'</td>'+
      COLS.map(c=>`<td class="${numCols.has(c)?'num':''}" title="${esc(String(row[c]??''))}">${fmt(row[c])}</td>`).join('')+
    '</tr>').join('');
  document.getElementById('tinfo').textContent=r.length+' rows · '+COLS.length+' columns';
}
function sortBy(col){
  if(sortCol===col)sortAsc=!sortAsc;else{sortCol=col;sortAsc=true}
  const s=[...DATA].sort((a,b)=>{
    const va=a[col],vb=b[col];
    if(isNum(va)&&isNum(vb))return sortAsc?va-vb:vb-va;
    return sortAsc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
  });
  buildTable(s);
}

/* ── SQL highlighting ── */
function hlSQL(sql){
  if(!sql)return'';
  const KW=['SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','JOIN','LEFT','RIGHT','INNER','OUTER','ON','AS','AND','OR','NOT','IN','LIKE','BETWEEN','LIMIT','OFFSET','DISTINCT','BY','WITH','UNION','ALL','CASE','WHEN','THEN','ELSE','END'];
  const FN=['COUNT','SUM','AVG','MAX','MIN','COALESCE','NULLIF','CAST','ROUND','FLOOR','CEIL','ABS','UPPER','LOWER','TRIM','LENGTH','SUBSTR','CONCAT','NOW','DATE','TO_DATE'];
  let s=esc(sql);
  KW.forEach(k=>{s=s.replace(new RegExp('\\b'+k+'\\b','gi'),m=>`<span class="skw">${m}</span>`)});
  FN.forEach(f=>{s=s.replace(new RegExp('\\b'+f+'\\b','gi'),m=>`<span class="sfn">${m}</span>`)});
  s=s.replace(/'([^']*)'/g,"<span class=\"sstr\">'$1'</span>");
  s=s.replace(/\\b(\\d+\\.?\\d*)\\b/g,'<span class="snum">$1</span>');
  return`<span class="sdef">${s}</span>`;
}
function copySQL(){
  const t=document.getElementById('rawsql').textContent;
  navigator.clipboard.writeText(t).then(()=>{
    const b=document.getElementById('csqlbtn');
    b.classList.add('ok');b.textContent='✓ Copied';
    setTimeout(()=>{b.classList.remove('ok');b.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy SQL';},2000);
  });
}
function copyURL(){
  navigator.clipboard.writeText(location.href).then(()=>{
    const b=document.getElementById('cbtn');
    b.classList.add('ok');b.textContent='✓ Copied';
    setTimeout(()=>{b.classList.remove('ok');b.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Share';},2000);
  });
}
function exportCSV(){
  const hdr=COLS.join(',');
  const rows=DATA.map(r=>COLS.map(c=>{const v=String(r[c]??'');return v.includes(',')||v.includes('"')?`"${v.replace(/"/g,'""')}"`:''+v}).join(','));
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent([hdr,...rows].join('\\n'));
  a.download='results.csv';a.click();
  const b=document.getElementById('expbtn');
  b.textContent='✓ Exported';
  setTimeout(()=>{b.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV';},2000);
}

window.addEventListener('DOMContentLoaded',()=>{
  buildChart();
  buildTable();
  const el=document.getElementById('sqldisplay');
  const raw=document.getElementById('rawsql');
  if(el&&raw)el.innerHTML=hlSQL(raw.textContent);
});
</script>
</body>
</html>"""


@router.get("/results/{result_id}", response_class=HTMLResponse, include_in_schema=False)
def result_page(result_id: str):
    """Shareable result page with chart, sortable table, and CSV export."""
    r = _result_store.get(result_id)
    if not r:
        return HTMLResponse(
            "<h2 style='font-family:sans-serif;padding:40px;color:#666'>Result not found or expired.</h2>",
            status_code=404
        )

    data    = r["data"]
    cols    = r["columns"] or (list(data[0].keys()) if data else [])
    sql     = r.get("sql", "")
    question = r.get("question", "")

    source_labels = {"demo_db": "Demo Database", "custom_db": "Custom Database", "uploaded_tables": "Uploaded CSV"}
    source_label  = source_labels.get(r.get("source", ""), "Database")

    if sql:
        sql_section = (
            '<div class="sc fu" style="animation-delay:.1s">'
            '<div class="sch">'
            '<span class="scht">Generated SQL</span>'
            '<button class="schact" id="csqlbtn" onclick="copySQL()">'
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
            '<rect x="9" y="9" width="13" height="13" rx="2"/>'
            '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
            ' Copy SQL</button></div>'
            f'<pre class="sqlpre" id="sqldisplay"><span id="rawsql">{_esc(sql)}</span></pre>'
            '</div>'
        )
    else:
        sql_section = ""

    html = _RESULT_PAGE_TEMPLATE
    html = html.replace("TMPL_QUESTION",  _esc(question))
    html = html.replace("TMPL_SOURCE",    _esc(source_label))
    html = html.replace("TMPL_ROWS",      str(len(data)))
    html = html.replace("TMPL_COLS",      str(len(cols)))
    html = html.replace("TMPL_SQL_SECTION", sql_section)
    from decimal import Decimal
    def _json_safe(obj):
        if isinstance(obj, Decimal): return float(obj)
        raise TypeError(type(obj).__name__)
    html = html.replace("TMPL_DATA_JSON", json.dumps(data[:200], default=_json_safe))
    html = html.replace("TMPL_COLS_JSON", json.dumps(cols))
    html = html.replace("TMPL_FRONTEND",  FRONTEND_URL)
    return HTMLResponse(html)


# ── Plugin UI ─────────────────────────────────────────────────────────────────

_PLUGIN_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DB Assistant</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0a0e1a;color:#e2e8f0;min-height:100vh}
.header{background:linear-gradient(135deg,#1e1b4b,#0f172a);border-bottom:1px solid #1e2d45;padding:20px 32px;display:flex;align-items:center;gap:16px}
.logo{width:42px;height:42px;background:#1e1b4b;border:1px solid rgba(129,140,248,.35);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#818cf8;flex-shrink:0}
.hdr-title{font-size:20px;font-weight:800;color:#f1f5f9}
.hdr-sub{font-size:12px;color:#64748b;margin-top:2px}
.badge{margin-left:auto;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#818cf8;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;white-space:nowrap}
.container{max-width:920px;margin:0 auto;padding:32px 24px}
.tabs{display:flex;gap:4px;background:#111827;border:1px solid #1e2d45;border-radius:12px;padding:4px;margin-bottom:24px}
.tab{flex:1;padding:10px;text-align:center;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#64748b;transition:all .15s;border:none;background:none}
.tab:hover{color:#94a3b8;background:rgba(255,255,255,.03)}
.tab.active{background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.2)}
.panel{display:none}.panel.active{display:block}
.card{background:#111827;border:1px solid #1e2d45;border-radius:12px;padding:20px;margin-bottom:16px}
.card-title{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.chip{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);color:#a5b4fc;padding:6px 14px;border-radius:20px;font-size:12px;cursor:pointer;transition:all .15s}
.chip:hover{background:rgba(99,102,241,.2);border-color:rgba(99,102,241,.4)}
.input-row{display:flex;gap:10px}
input[type=text],textarea{width:100%;background:#0f1729;border:1px solid #1e2d45;border-radius:8px;color:#e2e8f0;padding:11px 14px;font-size:14px;outline:none;font-family:inherit;transition:border-color .15s}
input[type=text]:focus,textarea:focus{border-color:rgba(99,102,241,.5)}
textarea{resize:vertical;min-height:80px}
.btn{background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap}
.btn:hover{background:#4338ca}.btn:disabled{opacity:.5;cursor:not-allowed}
.sql-block{font-family:"JetBrains Mono","Fira Code",monospace;font-size:12px;color:#93c5fd;background:#0f1729;border:1px solid #1e2d45;border-radius:8px;padding:14px 16px;overflow-x:auto;white-space:pre-wrap;line-height:1.6}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#1a2234}
th{padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #1e2d45}
td{padding:9px 12px;border-bottom:1px solid rgba(30,45,69,.5);color:#cbd5e1}
tr:hover td{background:rgba(99,102,241,.04)}
.stats{display:flex;gap:10px;margin-bottom:16px}
.stat{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.15);border-radius:8px;padding:12px 16px;flex:1;text-align:center}
.stat-val{font-size:20px;font-weight:900;color:#818cf8}
.stat-label{font-size:10px;color:#64748b;margin-top:2px}
.result-link{display:inline-flex;align-items:center;gap:6px;color:#818cf8;font-size:13px;text-decoration:none;border:1px solid rgba(99,102,241,.3);border-radius:8px;padding:8px 14px;transition:all .15s;margin-top:14px}
.result-link:hover{background:rgba(99,102,241,.1)}
.tag-list{display:flex;flex-wrap:wrap;gap:8px}
.tag{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:#6ee7b7;padding:4px 12px;border-radius:6px;font-size:12px;font-family:monospace}
.code-block{background:#0f1729;border:1px solid #1e2d45;border-radius:8px;padding:14px 16px 14px 16px;font-family:"JetBrains Mono","Fira Code",monospace;font-size:12px;color:#93c5fd;white-space:pre;overflow-x:auto;position:relative;margin-bottom:16px}
.copy-btn{position:absolute;top:8px;right:8px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#818cf8;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit}
.copy-btn:hover{background:rgba(99,102,241,.25)}
.status{border-radius:8px;padding:12px 16px;font-size:13px;margin-top:12px}
.status.success{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:#6ee7b7}
.status.error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#fca5a5}
.section-label{font-size:11px;font-weight:600;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(129,140,248,.3);border-top-color:#818cf8;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px}
.loading-card{background:#111827;border:1px solid #1e2d45;border-radius:12px;padding:30px;text-align:center;color:#64748b;margin-bottom:16px}
.hidden{display:none!important}
.empty-state{text-align:center;padding:32px;color:#64748b;font-size:13px}
</style>
</head>
<body>

<div class="header">
  <div class="logo">DB</div>
  <div>
    <div class="hdr-title">DB Assistant</div>
    <div class="hdr-sub">Natural Language Database Queries &middot; Powered by Gemini AI</div>
  </div>
  <div class="badge">82% KDD Cup 2026</div>
</div>

<div class="container">

  <div class="tabs">
    <button class="tab active" onclick="switchTab('demo',this)">&#127756; Demo Database</button>
    <button class="tab" onclick="switchTab('connect',this)">&#128268; Connect Your DB</button>
    <button class="tab" onclick="switchTab('cli',this)">&#128187; Claude Code CLI</button>
  </div>

  <!-- ── Demo DB ── -->
  <div class="panel active" id="panel-demo">
    <div class="card">
      <div class="card-title">Sample Questions &mdash; click to try</div>
      <div class="chips">
        <div class="chip" onclick="setQ(this)">How many employees are in each department?</div>
        <div class="chip" onclick="setQ(this)">What is the average salary by department?</div>
        <div class="chip" onclick="setQ(this)">Which department has the highest budget?</div>
        <div class="chip" onclick="setQ(this)">Show top 5 orders by revenue</div>
        <div class="chip" onclick="setQ(this)">What is total revenue by product?</div>
        <div class="chip" onclick="setQ(this)">List all employees in Engineering</div>
      </div>
      <div class="input-row">
        <input type="text" id="demo-q" placeholder="Ask anything about employees, departments, orders, sales..." onkeydown="if(event.key==='Enter')runDemo()"/>
        <button class="btn" id="demo-btn" onclick="runDemo()">Run Query</button>
      </div>
    </div>

    <div id="demo-loading" class="loading-card hidden"><span class="spinner"></span>Generating SQL and fetching results&hellip;</div>
    <div id="demo-error" class="status error hidden"></div>

    <div id="demo-result" class="hidden">
      <div class="stats">
        <div class="stat"><div class="stat-val" id="d-rows">0</div><div class="stat-label">Rows</div></div>
        <div class="stat"><div class="stat-val" id="d-cols">0</div><div class="stat-label">Columns</div></div>
        <div class="stat"><div class="stat-val">Neon</div><div class="stat-label">Demo DB</div></div>
      </div>
      <div class="card">
        <div class="card-title">Generated SQL</div>
        <div class="sql-block" id="d-sql"></div>
      </div>
      <div class="card">
        <div class="card-title">Results</div>
        <div class="table-wrap" id="d-table"></div>
        <a id="d-link" href="#" target="_blank" class="result-link">&#8599; View Full Results Page</a>
      </div>
    </div>
  </div>

  <!-- ── Connect DB ── -->
  <div class="panel" id="panel-connect">
    <div class="card">
      <div class="card-title">PostgreSQL Connection String</div>
      <textarea id="conn-str" placeholder="postgresql://username:password@host:5432/database&#10;&#10;Works with: Neon, Supabase, RDS, Cloud SQL, local PostgreSQL&hellip;"></textarea>
      <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
        <button class="btn" id="conn-btn" onclick="testConn()">Test &amp; Connect</button>
        <span style="font-size:12px;color:#64748b">Not stored permanently &mdash; session only</span>
      </div>
    </div>

    <div id="conn-loading" class="loading-card hidden"><span class="spinner"></span>Testing connection&hellip;</div>
    <div id="conn-error" class="status error hidden"></div>

    <div id="conn-result" class="hidden">
      <div class="card">
        <div class="card-title">Tables Found</div>
        <div class="tag-list" id="conn-tables"></div>
      </div>
      <div class="status success" id="conn-status"></div>
    </div>
  </div>

  <!-- ── Claude Code CLI ── -->
  <div class="panel" id="panel-cli">
    <div class="card">
      <div class="card-title">Install</div>
      <p style="font-size:13px;color:#94a3b8;margin-bottom:16px">Use DB Assistant slash commands directly inside Claude Code.</p>

      <div class="section-label">1. Install Claude Code CLI</div>
      <div class="code-block">npm install -g @anthropic-ai/claude-code<button class="copy-btn" onclick="cp(this)">Copy</button></div>

      <div class="section-label">2. Install the DB Assistant plugin</div>
      <div class="code-block">claude plugins install https://github.com/rutuja-patil24/database-assistant/tree/main/db-assistant-plugin<button class="copy-btn" onclick="cp(this)">Copy</button></div>
    </div>

    <div class="card">
      <div class="card-title">Commands</div>

      <div style="margin-bottom:16px">
        <div class="section-label">Query the demo database</div>
        <div class="code-block">/db-assistant:query How many employees are in each department?<button class="copy-btn" onclick="cp(this)">Copy</button></div>
      </div>

      <div style="margin-bottom:16px">
        <div class="section-label">Connect your own database</div>
        <div class="code-block">/db-assistant:connect postgresql://user:pass@host/db<button class="copy-btn" onclick="cp(this)">Copy</button></div>
      </div>

      <div>
        <div class="section-label">View KDD Cup benchmark scores</div>
        <div class="code-block">/db-assistant:benchmark<button class="copy-btn" onclick="cp(this)">Copy</button></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Demo Database Tables</div>
      <div class="tag-list">
        <span class="tag">employees &mdash; 50 rows</span>
        <span class="tag">departments &mdash; 10 rows</span>
        <span class="tag">orders &mdash; 200 rows</span>
        <span class="tag">sales_performance &mdash; 40 rows</span>
      </div>
      <p style="font-size:12px;color:#64748b;margin-top:12px">Pre-loaded Neon PostgreSQL &mdash; no setup needed.</p>
    </div>
  </div>

</div><!-- /container -->

<script>
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
}
function setQ(el) { document.getElementById('demo-q').value = el.textContent; }

async function runDemo() {
  const q = document.getElementById('demo-q').value.trim();
  if (!q) return;
  const btn = document.getElementById('demo-btn');
  btn.disabled = true;
  hide('demo-result'); hide('demo-error');
  show('demo-loading');
  try {
    const r = await fetch('/plugin/query', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({question:q, tables:{}})
    });
    const d = await r.json();
    hide('demo-loading');
    if (d.error) { showErr('demo-error', d.error); return; }
    const preview = d.preview || [];
    const cols = preview.length ? Object.keys(preview[0]) : [];
    document.getElementById('d-rows').textContent = d.row_count || 0;
    document.getElementById('d-cols').textContent = cols.length;
    document.getElementById('d-sql').textContent = d.sql || '';
    document.getElementById('d-link').href = d.result_url || '#';
    const wrap = document.getElementById('d-table');
    if (preview.length) {
      const hdr = cols.map(c => '<th>'+esc(c)+'</th>').join('');
      const rows = preview.map(row =>
        '<tr>'+cols.map(c => '<td>'+esc(row[c]!=null?row[c]:'')+'</td>').join('')+'</tr>'
      ).join('');
      wrap.innerHTML = '<table><thead><tr>'+hdr+'</tr></thead><tbody>'+rows+'</tbody></table>';
    } else {
      wrap.innerHTML = '<div class="empty-state">No results returned</div>';
    }
    show('demo-result');
  } catch(e) { hide('demo-loading'); showErr('demo-error', e.message); }
  finally { btn.disabled = false; }
}

async function testConn() {
  const cs = document.getElementById('conn-str').value.trim();
  if (!cs) return;
  const btn = document.getElementById('conn-btn');
  btn.disabled = true;
  hide('conn-result'); hide('conn-error');
  show('conn-loading');
  try {
    const r = await fetch('/plugin/connect', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({connection_string:cs, session_id:'ui-'+Date.now()})
    });
    const d = await r.json();
    hide('conn-loading');
    if (!r.ok || !d.success) { showErr('conn-error', d.detail||d.error||'Connection failed'); return; }
    const tables = d.tables_found || [];
    document.getElementById('conn-tables').innerHTML = tables.map(t => '<span class="tag">'+esc(t)+'</span>').join('');
    document.getElementById('conn-status').textContent = '✓ ' + (d.message||'Connected');
    show('conn-result');
  } catch(e) { hide('conn-loading'); showErr('conn-error', e.message); }
  finally { btn.disabled = false; }
}

function cp(btn) {
  const txt = btn.parentElement.textContent.replace(/Copy$|Copied!$/,'').trim();
  navigator.clipboard.writeText(txt).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function showErr(id, msg) { const el=document.getElementById(id); el.textContent='Error: '+msg; el.classList.remove('hidden'); }
function esc(v) { return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
</script>
</body>
</html>"""


@router.get("/plugin-ui", response_class=HTMLResponse, tags=["plugin"])
def plugin_ui():
    """Self-contained web UI for DB Assistant plugin."""
    return HTMLResponse(_PLUGIN_UI_HTML)