# backend/app/agents/swarm_orchestrator.py
"""
Swarm Orchestrator — supports PostgreSQL, MySQL, and MongoDB.

Runs multiple query agents in parallel using ThreadPoolExecutor,
then combines their results with the SwarmSummaryAgent.

Pipeline:
  1. SwarmPlannerAgent  — splits question into 2-4 subtasks
  2. Parallel agents    — each subtask runs independently (concurrent.futures)
  3. SwarmSummaryAgent  — combines all results into a unified report
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

from app.state.agent_state import AgentState
from app.agents.pg_schema_agent      import PgSchemaAgent
from app.agents.react_agent          import ReActAgent
from app.agents.swarm_planner_agent  import plan_subtasks
from app.agents.swarm_summary_agent  import summarize_swarm_results

logger = logging.getLogger("db_assistant.swarm_orchestrator")

MAX_WORKERS  = 4
MAX_SUBTASKS = 4


class SwarmOrchestrator:
    """
    Parallel agent swarm for PostgreSQL, MySQL, and MongoDB queries.
    """

    def __init__(self):
        self.schema_agent = PgSchemaAgent()
        self.react_agent  = ReActAgent()

    # ── PostgreSQL Swarm ─────────────────────────────────────────────────
    def run(
        self,
        pg_uri:         str,
        question:       str,
        limit:          int = 50,
        max_subtasks:   int = MAX_SUBTASKS,
        allowed_tables: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        t0 = time.time()
        logger.info("SwarmOrchestrator [PG]: starting for: %s", question)

        # Step 1: Discover schema once
        schema_state = AgentState(
            source        = "postgresql",
            pg_uri        = pg_uri,
            user_question = question,
            limit         = limit,
        )
        schema_state = self.schema_agent.run(schema_state)

        if schema_state.execution_error:
            return self._error_response(schema_state.execution_error, t0)

        # Filter to allowed tables when specified (e.g. uploaded datasets)
        if allowed_tables:
            schema_state.tables_schema = {
                k: v for k, v in schema_state.tables_schema.items()
                if any(k == t or k.endswith(f".{t}") for t in allowed_tables)
            }
            if not schema_state.tables_schema:
                return self._error_response("None of the specified tables were found.", t0)

        table_names = list(schema_state.tables_schema.keys())

        # Step 2: Plan subtasks
        subtasks = plan_subtasks(question, table_names)
        subtasks = subtasks[:max_subtasks]

        # Step 3: Run in parallel
        subtask_results = self._run_parallel(
            subtasks      = subtasks,
            runner        = self._run_pg_subtask,
            runner_kwargs = {
                "pg_uri":        pg_uri,
                "tables_schema": schema_state.tables_schema,
                "enum_values":   schema_state.enum_values,
                "join_hints":    schema_state.join_hints,
                "limit":         limit,
            },
        )

        # Step 4: Sort + summarize
        subtask_results = self._sort_results(subtask_results, subtasks)
        summary = summarize_swarm_results(question, subtask_results)

        return self._build_response(question, subtasks, subtask_results, summary, t0)

    # ── MySQL Swarm ──────────────────────────────────────────────────────
    def run_mysql(
        self,
        host:         str,
        port:         int,
        database:     str,
        username:     str,
        password:     str,
        question:     str,
        limit:        int = 50,
        max_subtasks: int = MAX_SUBTASKS,
    ) -> Dict[str, Any]:
        t0 = time.time()
        logger.info("SwarmOrchestrator [MySQL]: starting for: %s", question)

        # Get MySQL table names for planning
        try:
            from app.services.mysql_service import get_mysql_tables, get_mysql_schema
            tables = get_mysql_tables(host, port, database, username, password)
        except Exception as e:
            return self._error_response(str(e), t0)

        # Plan subtasks
        subtasks = plan_subtasks(question, tables)
        subtasks = subtasks[:max_subtasks]

        # Run in parallel
        subtask_results = self._run_parallel(
            subtasks      = subtasks,
            runner        = self._run_mysql_subtask,
            runner_kwargs = {
                "host":     host,
                "port":     port,
                "database": database,
                "username": username,
                "password": password,
                "tables":   tables,
                "limit":    limit,
            },
        )

        subtask_results = self._sort_results(subtask_results, subtasks)
        summary = summarize_swarm_results(question, subtask_results)

        return self._build_response(question, subtasks, subtask_results, summary, t0)

    # ── MongoDB Swarm ────────────────────────────────────────────────────
    def run_mongo(
        self,
        mongo_uri:   str,
        db_name:     str,
        collections: List[str],
        question:    str,
        limit:       int = 50,
        max_subtasks: int = MAX_SUBTASKS,
    ) -> Dict[str, Any]:
        t0 = time.time()
        logger.info("SwarmOrchestrator [Mongo]: starting for: %s", question)

        # Plan subtasks using collection names
        subtasks = plan_subtasks(question, collections)
        subtasks = subtasks[:max_subtasks]

        # Run in parallel
        subtask_results = self._run_parallel(
            subtasks      = subtasks,
            runner        = self._run_mongo_subtask,
            runner_kwargs = {
                "mongo_uri":   mongo_uri,
                "db_name":     db_name,
                "collections": collections,
                "limit":       limit,
            },
        )

        subtask_results = self._sort_results(subtask_results, subtasks)
        summary = summarize_swarm_results(question, subtask_results)

        return self._build_response(question, subtasks, subtask_results, summary, t0)

    # ── Shared parallel runner ────────────────────────────────────────────
    def _run_parallel(
        self,
        subtasks:      List[str],
        runner,
        runner_kwargs: Dict,
    ) -> List[Dict]:
        results = []
        futures = {}

        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(subtasks))) as executor:
            for subtask_question in subtasks:
                future = executor.submit(
                    runner,
                    question=subtask_question,
                    **runner_kwargs,
                )
                futures[future] = subtask_question

            for future in as_completed(futures):
                subtask_question = futures[future]
                try:
                    result = future.result(timeout=60)
                    results.append(result)
                except Exception as e:
                    logger.error("SwarmOrchestrator: subtask failed: %s", e)
                    results.append({
                        "question":          subtask_question,
                        "error":             str(e),
                        "count":             0,
                        "data":              [],
                        "columns":           [],
                        "sql":               None,
                        "execution_time_ms": None,
                        "react_trace":       None,
                    })
        return results

    # ── PostgreSQL subtask runner ─────────────────────────────────────────
    def _run_pg_subtask(
        self,
        question:      str,
        pg_uri:        str,
        tables_schema: Dict,
        enum_values:   Dict,
        join_hints:    List,
        limit:         int,
    ) -> Dict[str, Any]:
        state = AgentState(
            source             = "postgresql",
            pg_uri             = pg_uri,
            user_question      = question,
            limit              = limit,
            tables_schema      = tables_schema,
            enum_values        = enum_values,
            join_hints         = join_hints,
            react_enabled      = True,
            react_max_attempts = 2,
        )
        state = self.react_agent.run(state)
        return {
            "question":          question,
            "sql":               state.generated_sql,
            "columns":           state.columns,
            "data":              state.results,
            "count":             len(state.results),
            "execution_time_ms": state.execution_time_ms,
            "tables_used":       state.tables_used,
            "error":             state.execution_error,
            "react_trace": {
                "attempts":       state.react_attempts,
                "self_corrected": state.react_attempts > 1,
                "thoughts":       state.react_thoughts,
                "actions":        state.react_actions,
                "observations":   state.react_observations,
            } if state.react_attempts > 0 else None,
        }

    # ── MySQL subtask runner ──────────────────────────────────────────────
    def _run_mysql_subtask(
        self,
        question: str,
        host:     str,
        port:     int,
        database: str,
        username: str,
        password: str,
        tables:   List[str],
        limit:    int,
    ) -> Dict[str, Any]:
        try:
            from app.services.mysql_service import (
                get_mysql_schema,
                generate_mysql_sql,
                execute_mysql_query,
            )
            import time as _time

            schema_prompt = get_mysql_schema(host, port, database, username, password, tables)
            t0 = _time.time()
            sql = generate_mysql_sql(schema_prompt, question)
            rows = execute_mysql_query(host, port, database, username, password, sql)
            elapsed = int((_time.time() - t0) * 1000)
            columns = list(rows[0].keys()) if rows else []

            return {
                "question":          question,
                "sql":               sql,
                "columns":           columns,
                "data":              rows,
                "count":             len(rows),
                "execution_time_ms": elapsed,
                "tables_used":       tables,
                "error":             None,
                "react_trace":       None,
            }
        except Exception as e:
            logger.error("MySQL subtask failed: %s", e)
            return {
                "question":          question,
                "sql":               None,
                "columns":           [],
                "data":              [],
                "count":             0,
                "execution_time_ms": None,
                "tables_used":       [],
                "error":             str(e),
                "react_trace":       None,
            }

    # ── MongoDB subtask runner ────────────────────────────────────────────
    def _run_mongo_subtask(
        self,
        question:    str,
        mongo_uri:   str,
        db_name:     str,
        collections: List[str],
        limit:       int,
    ) -> Dict[str, Any]:
        try:
            from app.agents.mongo_query_agent import MongoQueryAgent
            from app.services.mongo_schema import (
                build_mongo_schema_prompt, infer_schema, get_date_candidates,
            )
            from app.services.mongo_execute import run_query
            import time as _time

            # Use first collection for schema
            collection = collections[0]
            schema = infer_schema(mongo_uri, db_name, collection, sample_size=100)
            schema_prompt = build_mongo_schema_prompt(schema)
            date_candidates = get_date_candidates(schema)
            date_field = date_candidates[0] if date_candidates else None

            agent = MongoQueryAgent()
            spec  = agent.run(
                schema_prompt = schema_prompt,
                question      = question,
                date_field    = date_field,
                limit         = limit,
            )

            t0 = _time.time()
            data, elapsed = run_query(mongo_uri, db_name, collection, spec)
            columns = list(data[0].keys()) if data else []

            return {
                "question":          question,
                "sql":               str(spec),
                "columns":           columns,
                "data":              data,
                "count":             len(data),
                "execution_time_ms": elapsed,
                "tables_used":       [collection],
                "error":             None,
                "react_trace":       None,
            }
        except Exception as e:
            logger.error("MongoDB subtask failed: %s", e)
            return {
                "question":          question,
                "sql":               None,
                "columns":           [],
                "data":              [],
                "count":             0,
                "execution_time_ms": None,
                "tables_used":       [],
                "error":             str(e),
                "react_trace":       None,
            }

    # ── Helpers ───────────────────────────────────────────────────────────
    def _sort_results(self, results: List[Dict], subtasks: List[str]) -> List[Dict]:
        order = {q: i for i, q in enumerate(subtasks)}
        results.sort(key=lambda r: order.get(r.get("question", ""), 999))
        return results

    def _build_response(
        self,
        question:        str,
        subtasks:        List[str],
        subtask_results: List[Dict],
        summary:         Dict,
        t0:              float,
    ) -> Dict[str, Any]:
        total_ms   = int((time.time() - t0) * 1000)
        successful = sum(1 for r in subtask_results if not r.get("error"))
        logger.info(
            "SwarmOrchestrator: complete — %d/%d succeeded in %dms",
            successful, len(subtasks), total_ms,
        )
        return {
            "question":         question,
            "subtasks":         subtasks,
            "subtask_results":  subtask_results,
            "summary":          summary,
            "total_ms":         total_ms,
            "agents_run":       len(subtasks),
            "agents_succeeded": successful,
        }

    def _error_response(self, error: str, t0: float) -> Dict[str, Any]:
        return {
            "error":            error,
            "subtasks":         [],
            "subtask_results":  [],
            "summary":          None,
            "total_ms":         int((time.time() - t0) * 1000),
            "agents_run":       0,
            "agents_succeeded": 0,
        }