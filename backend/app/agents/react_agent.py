# backend/app/agents/react_agent.py
"""
ReAct (Reasoning + Acting) Agent for PostgreSQL queries.

Implements the ReAct loop:
  Think → Act → Observe → (retry if needed)

Wraps the existing NLToSQL + Safety + Execution pipeline with
self-correction logic — up to react_max_attempts retries.
"""
from __future__ import annotations

import logging
from app.state.agent_state import AgentState
from app.agents.pg_nl_to_sql_agent import PgNLToSQLAgent
from app.agents.pg_safety_agent    import PgSafetyAgent
from app.agents.pg_execution_agent import PgExecutionAgent
from app.services.nl_to_sql        import generate_sql

logger = logging.getLogger("db_assistant.react_agent")


class ReActAgent:
    """
    ReAct loop agent for PostgreSQL queries.

    Reads from:  state.tables_schema, state.enum_values,
                 state.join_hints, state.user_question
    Writes to:   state.generated_sql, state.results, state.columns,
                 state.react_thoughts, state.react_actions,
                 state.react_observations, state.react_attempts
    """

    def __init__(self):
        self.nl_to_sql_agent = PgNLToSQLAgent()
        self.safety_agent    = PgSafetyAgent()
        self.execution_agent = PgExecutionAgent()

    def run(self, state: AgentState) -> AgentState:
        if not state.react_enabled:
            # Fall back to single-pass pipeline
            state = self.nl_to_sql_agent.run(state)
            if state.execution_error:
                return state
            state = self.safety_agent.run(state)
            if state.execution_error:
                return state
            return self.execution_agent.run(state)

        max_attempts = state.react_max_attempts
        state.react_attempts = 0

        for attempt in range(1, max_attempts + 1):
            state.react_attempts = attempt
            logger.info("ReActAgent: attempt %d/%d", attempt, max_attempts)

            # ── THINK ──────────────────────────────────────────────────
            thought = self._think(state, attempt)
            state.react_thoughts.append(thought)
            logger.info("ReActAgent THINK: %s", thought)

            # ── ACT: Generate SQL ───────────────────────────────────────
            action = f"Attempt {attempt}: Generate SQL for: {state.user_question}"
            state.react_actions.append(action)

            # Clear previous errors before retry
            state.execution_error = None
            state.safety_passed   = False

            # Inject error context into state for smarter regeneration
            if state.previous_sql_errors:
                state = self._inject_error_context(state)

            state = self.nl_to_sql_agent.run(state)

            if state.execution_error:
                observation = f"SQL generation failed: {state.execution_error}"
                state.react_observations.append(observation)
                state.previous_sql_errors.append(state.execution_error)
                state.execution_error = None
                logger.warning("ReActAgent: %s", observation)
                continue

            action_detail = f"Generated SQL: {state.generated_sql[:200]}"
            state.react_actions[-1] = action_detail

            # ── ACT: Safety check ───────────────────────────────────────
            state = self.safety_agent.run(state)

            if state.execution_error:
                observation = f"Safety check failed: {state.execution_error}"
                state.react_observations.append(observation)
                state.previous_sql_errors.append(state.execution_error)
                state.execution_error = None
                logger.warning("ReActAgent: %s", observation)
                continue

            # ── ACT: Execute ────────────────────────────────────────────
            state = self.execution_agent.run(state)

            # ── OBSERVE ─────────────────────────────────────────────────
            observation = self._observe(state, attempt)
            state.react_observations.append(observation)
            logger.info("ReActAgent OBSERVE: %s", observation)

            if state.execution_error:
                # Execution failed — record error and retry
                state.previous_sql_errors.append(state.execution_error)
                state.execution_error = None
                logger.warning("ReActAgent: execution failed on attempt %d, retrying", attempt)
                continue

            if len(state.results) == 0 and attempt < max_attempts:
                # Empty results — try a broader query
                logger.info("ReActAgent: empty results on attempt %d, retrying with broader query", attempt)
                state.previous_sql_errors.append("Query returned 0 rows — try a broader or different query")
                continue

            # Success — exit the loop
            logger.info(
                "ReActAgent: success on attempt %d — %d rows returned",
                attempt, len(state.results)
            )
            break

        # If all attempts failed, restore last execution error
        if state.execution_error is None and len(state.results) == 0 and state.previous_sql_errors:
            # Do not raise error for empty results — that is valid
            pass

        return state

    # ── Private helpers ─────────────────────────────────────────────────

    def _think(self, state: AgentState, attempt: int) -> str:
        """Generate a thought based on current state."""
        if attempt == 1:
            tables = list(state.tables_schema.keys())
            return (
                f"I need to answer: '{state.user_question}'. "
                f"Available tables: {', '.join(tables[:5])}. "
                f"I will generate SQL to answer this question."
            )
        elif attempt == 2 and state.previous_sql_errors:
            last_error = state.previous_sql_errors[-1]
            return (
                f"Attempt {attempt - 1} failed: {last_error[:200]}. "
                f"I need to fix the SQL — checking column names and "
                f"using only valid enum values from the schema."
            )
        else:
            return (
                f"Attempt {attempt - 1} failed or returned empty results. "
                f"I will try a simpler, broader query to answer: "
                f"'{state.user_question}'."
            )

    def _observe(self, state: AgentState, attempt: int) -> str:
        """Describe what happened after execution."""
        if state.execution_error:
            return f"Execution failed: {state.execution_error[:200]}"
        row_count = len(state.results)
        if row_count == 0:
            return f"Query executed but returned 0 rows. SQL may need to be broader."
        return (
            f"Success — {row_count} rows returned in "
            f"{state.execution_time_ms or 0}ms using SQL: "
            f"{(state.generated_sql or '')[:150]}"
        )

    def _inject_error_context(self, state: AgentState) -> AgentState:
        """
        Inject previous error context into the question so the
        NLToSQL agent can generate a better SQL on retry.
        """
        error_summary = "; ".join(state.previous_sql_errors[-2:])
        state.user_question = (
            f"{state.user_question}\n\n"
            f"[CORRECTION NEEDED] Previous attempt failed: {error_summary}. "
            f"Fix the SQL — use only valid column names from the schema, "
            f"use correct table names with schema prefix, "
            f"and only use enum values listed in the schema."
        )
        return state