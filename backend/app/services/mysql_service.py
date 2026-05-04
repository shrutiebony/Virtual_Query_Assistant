import mysql.connector
from mysql.connector import Error
import google.generativeai as genai
import os
import re

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

SYSTEM_PROMPT = """You are a MySQL SQL generator.

Rules:
- Use ONLY the provided table and column names
- Do NOT hallucinate tables or columns not in the schema
- Do NOT use DELETE, UPDATE, DROP, INSERT, ALTER, CREATE, TRUNCATE
- Return ONLY SQL. No explanation. No markdown. No code fences.
- The SQL MUST start with SELECT
- Use proper JOIN conditions based on the schema provided
- Use backticks for table and column names in MySQL
- Use LIMIT 100 if no limit is specified
- Use MySQL-specific syntax (LIMIT instead of TOP, IFNULL instead of COALESCE where appropriate)
"""

def get_mysql_connection(host: str, port: int, database: str, username: str, password: str):
    """Create and return a MySQL connection."""
    try:
        conn = mysql.connector.connect(
            host=host,
            port=port,
            database=database,
            user=username,
            password=password,
            connection_timeout=8,
            autocommit=True
        )
        return conn
    except Error as e:
        raise Exception(f"MySQL connection failed: {str(e)}")


def get_mysql_tables(host: str, port: int, database: str, username: str, password: str):
    """List all tables in the MySQL database."""
    conn = get_mysql_connection(host, port, database, username, password)
    try:
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        return tables
    finally:
        conn.close()


def get_mysql_schema(host: str, port: int, database: str, username: str, password: str, tables: list):
    """Fetch schema for selected tables."""
    conn = get_mysql_connection(host, port, database, username, password)
    try:
        cursor = conn.cursor()
        schema_parts = []
        for table in tables:
            cursor.execute(f"DESCRIBE `{table}`")
            columns = cursor.fetchall()
            col_lines = [f"  - {col[0]} ({col[1]})" for col in columns]
            schema_parts.append(f"Table: {table}\nColumns:\n" + "\n".join(col_lines))
        return "\n\n".join(schema_parts)
    finally:
        conn.close()


def ensure_safe_mysql(sql: str) -> str:
    """Validate and sanitize MySQL SQL query."""
    # Strip markdown fences
    sql = re.sub(r'```sql|```mysql|```', '', sql, flags=re.IGNORECASE).strip()

    # Normalize whitespace
    sql = re.sub(r'\s+', ' ', sql).strip()

    # Remove string literals before keyword scan
    clean = re.sub(r"'(?:''|[^'])*'", "''", sql)
    clean = re.sub(r'"(?:""|[^"])*"', '""', clean)

    # Scan for dangerous keywords
    banned = ['delete', 'update', 'drop', 'alter', 'truncate',
              'insert', 'create', 'grant', 'revoke', 'replace']
    for keyword in banned:
        if re.search(rf'\b{keyword}\b', clean, re.IGNORECASE):
            raise ValueError(f"Unsafe keyword detected: {keyword}")

    # Verify SELECT
    if not re.search(r'\bSELECT\b', clean, re.IGNORECASE):
        raise ValueError("Only SELECT statements are allowed")

    # Inject LIMIT if missing
    if not re.search(r'\bLIMIT\b', clean, re.IGNORECASE):
        sql = sql.rstrip(';') + ' LIMIT 100'

    return sql


def generate_mysql_sql(schema_prompt: str, question: str) -> str:
    """Generate MySQL SQL from natural language using Gemini."""
    try:
        client = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT
        )
        prompt = f"{schema_prompt}\n\nUser Question: {question}\n\nReturn ONLY MySQL SQL:"
        response = client.generate_content(
            prompt,
            generation_config={"temperature": 0.0}
        )
        raw_sql = response.text.strip()
        return ensure_safe_mysql(raw_sql)
    except ValueError as e:
        raise e
    except Exception as e:
        raise Exception(f"Gemini API error: {str(e)}")


def execute_mysql_query(host: str, port: int, database: str,
                        username: str, password: str, sql: str):
    """Execute a MySQL SELECT query and return results."""
    conn = get_mysql_connection(host, port, database, username, password)
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql)
        rows = cursor.fetchall()
        # Convert non-serializable types
        results = []
        for row in rows:
            clean_row = {}
            for k, v in row.items():
                if hasattr(v, 'isoformat'):
                    clean_row[k] = v.isoformat()
                elif isinstance(v, bytes):
                    clean_row[k] = v.decode('utf-8', errors='replace')
                else:
                    clean_row[k] = v
            results.append(clean_row)
        return results
    finally:
        conn.close()
        