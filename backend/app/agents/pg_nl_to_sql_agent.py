# backend/app/agents/pg_nl_to_sql_agent.py
from __future__ import annotations
import logging
from app.services.nl_to_sql import generate_sql
from app.state.agent_state import AgentState
logger = logging.getLogger("db_assistant.pg_nl_to_sql_agent")


def _build_schema_prompt(state: AgentState) -> str:
    prompt = "You have access to the following PostgreSQL tables:\n\n"
    for fqn, cols in state.tables_schema.items():
        prompt += f"Table: {fqn}\nColumns:\n"
        for c in cols:
            col_line = f"  - {c['name']} ({c['pg_type']})"
            # Add sample values if available — critical for non-English data
            if c.get("sample_values"):
                samples = [str(v) for v in c["sample_values"][:4]]
                col_line += f"  [e.g. {', '.join(samples)}]"
            prompt += col_line + "\n"
        prompt += "\n"
    return prompt


def _build_context_block(state: AgentState) -> str:
    blocks = []

    # JOIN hints
    if state.join_hints:
        blocks.append("JOIN keys (use these when joining tables):\n" +
                      "\n".join(state.join_hints))

    # Enum values — CRITICAL for correct WHERE filters
    if state.enum_values:
        lines = [f"  - {key}: {', '.join(vals)}"
                 for key, vals in state.enum_values.items()]
        blocks.append(
            "CRITICAL — actual data values "
            "(use ONLY these exact strings in WHERE filters, never invent others):\n" +
            "\n".join(lines)
        )

    blocks.append(
        "Rules:\n"
        "- Choose ONLY the tables needed to answer the question\n"
        "- Write JOIN queries when data spans multiple tables\n"
        "- Always use fully qualified table names (schema.table)\n"
        "- Use ONLY the exact values listed above for categorical WHERE filters\n"
        "- Use sample values shown in schema to understand actual data format\n"
        "- For non-English data: use the EXACT values shown in sample — never translate\n"
        "- For single-answer questions (which/who/what is THE): use LIMIT 1\n"
        "- For element names: use LOWERCASE chemical symbols (p, n, br, i, c, o, s, cl) — the data stores them in lowercase\n"
        "- For integer columns: compare with integers not strings\n"
        "- For link/FK columns: JOIN to lookup table to get the actual name\n"
        f"- Add LIMIT {state.limit} at the end\n"
        "- Return ONLY valid SQL, no explanation, no markdown"
    )
    return "\n\n".join(blocks)


class PgNLToSQLAgent:
    """
    Agent 2 (PostgreSQL) — Natural Language to SQL.
    Reads from:  state.tables_schema, state.enum_values,
                 state.join_hints, state.user_question, state.limit
    Writes to:   state.generated_sql
    """
    def run(self, state: AgentState) -> AgentState:
        if not state.user_question:
            state.execution_error = "PgNLToSQLAgent: user_question is missing."
            return state
        if not state.tables_schema:
            state.execution_error = "PgNLToSQLAgent: tables_schema is empty. Run PgSchemaAgent first."
            return state

        schema_prompt = _build_schema_prompt(state)
        context_block = _build_context_block(state)
        full_question = f"{state.user_question}\n\n{context_block}"

        try:
            sql = generate_sql(schema_prompt, full_question)
            sql = sql.strip().rstrip(";")
            # Remove duplicate LIMIT clauses (e.g. LIMIT 1 LIMIT 200)
            import re as _re
            limit_matches = list(_re.finditer(r'\bLIMIT\s+\d+', sql, _re.IGNORECASE))
            if len(limit_matches) > 1:
                last_limit = limit_matches[-1]
                for m in reversed(limit_matches[:-1]):
                    sql = sql[:m.start()] + sql[m.end():]
            # Fix alias mixing: if query uses AS T1/T2 aliases, replace benchmark_tmp.table.col with alias.col
            alias_map = {}
            for m in _re.finditer(r'benchmark_tmp\.\w+\s+AS\s+(\w+)', sql, _re.IGNORECASE):
                tname = _re.search(r'benchmark_tmp\.(\w+)\s+AS', m.group(0), _re.IGNORECASE).group(1)
                alias_map[tname.lower()] = m.group(1)
            for tname, alias in alias_map.items():
                sql = _re.sub(rf'benchmark_tmp\.{tname}\.', f'{alias}.', sql, flags=_re.IGNORECASE)
            # Ensure LIMIT is present
            if "limit" not in sql.lower():
                sql += f" LIMIT {state.limit}"
            state.generated_sql = sql
            logger.info("PgNLToSQLAgent: SQL generated (%d chars)", len(sql))
        except Exception as e:
            state.execution_error = f"SQL generation failed: {e}"
        return state