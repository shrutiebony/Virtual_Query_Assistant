# DB Assistant Benchmark Command

Show the KDD Cup 2026 benchmark accuracy score for DB Assistant.

## Usage
```
/db-assistant:benchmark
```

<execute>
import urllib.request, json

url = "https://db-assistant-backend-105401535311.us-central1.run.app/benchmark/results"
try:
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read())
    
    acc     = data.get("accuracy", 0)
    total   = data.get("total", 0)
    passed  = data.get("passed", 0)
    by_diff = data.get("by_difficulty", {})
    
    print(f"\n📊 DB Assistant — KDD Cup 2026 Benchmark\n")
    print(f"**Overall Accuracy: {acc}%** ({passed}/{total} tasks passed)\n")
    print(f"| Difficulty | Accuracy | Passed |")
    print(f"|---|---|---|")
    for diff, d in by_diff.items():
        print(f"| {diff.capitalize()} | {d['accuracy']}% | {d['passed']}/{d['total']} |")
    print(f"\n👉 **Dashboard:** https://db-assistant-frontend-105401535311.us-central1.run.app")

except Exception as e:
    print(f"Error: {e}")
</execute>