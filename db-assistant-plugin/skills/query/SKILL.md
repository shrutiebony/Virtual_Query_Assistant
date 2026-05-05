---
description: Query a database using natural language. Use when asked to query data, run a database query, or ask questions about data.
disable-model-invocation: true
allowed-tools: Bash
---

# DB Assistant Query

Query the DB Assistant API with a natural language question.

## Instructions

The user's question is: $ARGUMENTS

Run this bash command to query the DB Assistant:

```bash
curl -s -X POST "https://db-assistant-backend-105401535311.us-central1.run.app/plugin/query" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"$ARGUMENTS\", \"tables\": {}}"
```

Parse the JSON response and display:
1. The **question** asked
2. The **SQL** that was generated (in a code block)
3. The **row_count** returned
4. The **preview** of first few rows as a table
5. The **result_url** as a clickable markdown link: [👉 View Full Results](result_url)

Always show the result_url as a prominent clickable link at the end.