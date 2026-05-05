from __future__ import annotations

import logging
import os
import traceback

from dotenv import load_dotenv
load_dotenv()  # loads backend/.env into environment
from contextlib import asynccontextmanager
from typing import Any, Optional

import motor.motor_asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth              import router as auth_router
from app.api.routes.history           import router as history_router
from app.api.routes.mongo             import router as mongo_router
from app.api.routes.pg_query          import router as pg_router
from app.api.routes.internal_datasets import router as datasets_router
from app.api.routes.genui             import router as genui_router
from app.api.routes.ai_functions      import router as ai_router
from app.api.routes.mysql_routes      import router as mysql_router
from app.api.routes.swarm             import router as swarm_router
from app.api.routes.benchmark         import router as benchmark_router
from app.api.routes.plugin            import router as plugin_router


logger = logging.getLogger(__name__)

# ── Startup / shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm-up: verify MongoDB reachability (non-fatal)
    mongo_uri = os.getenv("MONGO_URI", "")
    if mongo_uri:
        try:
            client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=3000)
            await client.admin.command("ping")
            logger.info("MongoDB connected")
        except Exception as exc:
            logger.warning(f"MongoDB not reachable at startup: {exc}")
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DB Assistant API",
    version="2.0.0",
    description="Multi-agent natural language database assistant",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(history_router)
app.include_router(pg_router)
app.include_router(mongo_router)
app.include_router(datasets_router)
app.include_router(genui_router)
app.include_router(ai_router)
app.include_router(mysql_router)
app.include_router(swarm_router)
app.include_router(benchmark_router)
app.include_router(plugin_router)

# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error: %s\n%s", exc, traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Health / ops endpoints ────────────────────────────────────────────────────
@app.get("/health", tags=["ops"])
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/db/ping", tags=["ops"])
def db_ping():
    from app.db import get_conn
    try:
        conn = get_conn()
        conn.close()
        return {"status": "ok", "message": "PostgreSQL reachable"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"PostgreSQL unreachable: {exc}")


@app.get("/mongo/ping", tags=["ops"])
async def mongo_ping():
    mongo_uri = os.getenv("MONGO_URI", "")
    if not mongo_uri:
        raise HTTPException(status_code=503, detail="MONGO_URI not configured")
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=3000)
        await client.admin.command("ping")
        return {"status": "ok", "message": "MongoDB reachable"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"MongoDB unreachable: {exc}")


# ── Open Claude Plugin ────────────────────────────────────────────────
@app.get("/.well-known/ai-plugin.json", include_in_schema=False)
def plugin_manifest():
    return {
        "schema_version": "v1",
        "name_for_human": "DB Assistant",
        "name_for_model": "db_assistant",
        "description_for_human": "Query any database using natural language.",
        "description_for_model": (
            "DB Assistant lets you query databases with natural language. "
            "Use GET /benchmark/results to get KDD Cup 2026 benchmark accuracy scores. "
            "Use POST /swarm/query for parallel multi-agent analysis. "
            "Use POST /my-datasets/benchmark-run to run SQL queries against uploaded data."
        ),
        "auth": {"type": "none"},
        "api": {
            "type": "openapi",
            "url": "https://db-assistant-backend-105401535311.us-central1.run.app/openapi.json"
        },
        "logo_url": "https://db-assistant-backend-105401535311.us-central1.run.app/logo.svg",
        "contact_email": "rutujabpatil839@gmail.com",
        "legal_info_url": "https://db-assistant-frontend-105401535311.us-central1.run.app"
    }


@app.get("/logo.svg", include_in_schema=False)
def logo():
    from fastapi.responses import Response
    svg = """<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
        <text x="50" y="65" font-size="48" text-anchor="middle" fill="#818cf8" font-weight="bold">DB</text>
    </svg>"""
    return Response(content=svg, media_type="image/svg+xml")


@app.post("/plugin/query", tags=["plugin"])
async def plugin_query(request: Request):
    """Open Claude Plugin - natural language query endpoint."""
    body = await request.json()
    question = body.get("question", "")
    tables   = body.get("tables", {})
    if not question:
        raise HTTPException(400, detail="question is required")
    from app.api.routes.internal_datasets import benchmark_run, BenchmarkRequest
    req = BenchmarkRequest(tables=tables, question=question, limit=50)
    result = benchmark_run(req)
    return {
        "question":  question,
        "sql":       result.get("sql", ""),
        "results":   result.get("data", [])[:20],
        "columns":   result.get("columns", []),
        "row_count": len(result.get("data", [])),
    }