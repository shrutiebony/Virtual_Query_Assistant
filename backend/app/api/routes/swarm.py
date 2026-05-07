# backend/app/api/routes/swarm.py
"""
Swarm API endpoints — PostgreSQL, MySQL, MongoDB.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.agents.swarm_orchestrator import SwarmOrchestrator
from app.api.routes.auth import get_current_user

logger = logging.getLogger("db_assistant.swarm")
router = APIRouter(prefix="/swarm", tags=["swarm"])

_swarm = SwarmOrchestrator()


# ── Request models ───────────────────────────────────────────────────────

class SwarmPgRequest(BaseModel):
    pg_uri:       str
    question:     str
    limit:        int = Field(50, ge=1, le=200)
    max_subtasks: int = Field(3,  ge=2, le=4)


class SwarmMySQLRequest(BaseModel):
    host:         str
    port:         int = 3306
    database:     str
    username:     str
    password:     str
    question:     str
    limit:        int = Field(50, ge=1, le=200)
    max_subtasks: int = Field(3,  ge=2, le=4)


class SwarmMongoRequest(BaseModel):
    mongo_uri:    str
    db_name:      str
    collections:  List[str]
    question:     str
    limit:        int = Field(50, ge=1, le=200)
    max_subtasks: int = Field(3,  ge=2, le=4)


# ── Endpoints ────────────────────────────────────────────────────────────

@router.post("/pg-query")
def swarm_pg_query(req: SwarmPgRequest, user=Depends(get_current_user)):
    """Swarm parallel agents for PostgreSQL."""
    try:
        result = _swarm.run(
            pg_uri       = req.pg_uri,
            question     = req.question,
            limit        = req.limit,
            max_subtasks = req.max_subtasks,
        )
        if result.get("error"):
            raise HTTPException(500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Swarm PG failed: %s", e, exc_info=True)
        raise HTTPException(500, detail=str(e))


@router.post("/mysql-query")
def swarm_mysql_query(req: SwarmMySQLRequest, user=Depends(get_current_user)):
    """Swarm parallel agents for MySQL."""
    try:
        result = _swarm.run_mysql(
            host         = req.host,
            port         = req.port,
            database     = req.database,
            username     = req.username,
            password     = req.password,
            question     = req.question,
            limit        = req.limit,
            max_subtasks = req.max_subtasks,
        )
        if result.get("error"):
            raise HTTPException(500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Swarm MySQL failed: %s", e, exc_info=True)
        raise HTTPException(500, detail=str(e))


@router.post("/mongo-query")
def swarm_mongo_query(req: SwarmMongoRequest, user=Depends(get_current_user)):
    """Swarm parallel agents for MongoDB."""
    try:
        result = _swarm.run_mongo(
            mongo_uri    = req.mongo_uri,
            db_name      = req.db_name,
            collections  = req.collections,
            question     = req.question,
            limit        = req.limit,
            max_subtasks = req.max_subtasks,
        )
        if result.get("error"):
            raise HTTPException(500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Swarm Mongo failed: %s", e, exc_info=True)
        raise HTTPException(500, detail=str(e))


class SwarmDatasetRequest(BaseModel):
    table_names:  List[str]
    question:     str
    limit:        int = Field(50, ge=1, le=200)
    max_subtasks: int = Field(3,  ge=2, le=4)


@router.post("/dataset-query")
def swarm_dataset_query(req: SwarmDatasetRequest, user=Depends(get_current_user)):
    """Swarm parallel agents over uploaded datasets stored in the system DB."""
    try:
        from app.api.routes.internal_datasets import _sys_uri
        result = _swarm.run(
            pg_uri         = _sys_uri(),
            question       = req.question,
            limit          = req.limit,
            max_subtasks   = req.max_subtasks,
            allowed_tables = req.table_names,
        )
        if result.get("error"):
            raise HTTPException(500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Swarm Dataset failed: %s", e, exc_info=True)
        raise HTTPException(500, detail=str(e))


@router.get("/health")
def swarm_health():
    return {"status": "ok", "databases": ["postgresql", "mysql", "mongodb", "datasets"]}