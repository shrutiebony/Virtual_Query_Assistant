# DB Assistant Query Command

Query any database using natural language and get results with a clickable URL.

## Usage
```
/db-assistant:query <your question>
```

## Examples
```
/db-assistant:query How many employees are in each department?
/db-assistant:query What is the average salary by city?
/db-assistant:query Show me all pending orders
```

## What happens
1. Your question is sent to the DB Assistant API
2. Gemini AI generates the SQL
3. Results are returned with a clickable URL
4. Open the URL to see the full results page

<execute>
import subprocess, json, sys

question = "$ARGUMENTS"
if not question:
    print("Usage: /db-assistant:query <your question>")
    sys.exit(1)

import urllib.request, urllib.error

url = "https://db-assistant-backend-105401535311.us-central1.run.app/plugin/query"
data = json.dumps({"question": question, "tables": {}}).encode()
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
    
    print(f"\n🤖 DB Assistant Result\n")
    print(f"**Question:** {question}\n")
    print(f"**SQL Generated:**")
    print(f"```sql")
    print(result.get("sql", ""))
    print(f"```\n")
    print(f"**Rows returned:** {result.get('row_count', 0)}\n")
    print(f"**Preview:** {result.get('preview', [])[:3]}\n")
    print(f"👉 **View Full Results:** {result.get('result_url', '')}")
    
except Exception as e:
    print(f"Error: {e}")
</execute>