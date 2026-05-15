---
description: Show KDD Cup 2026 benchmark accuracy score for DB Assistant.
disable-model-invocation: true
allowed-tools: Bash
---

# DB Assistant — Benchmark Score

Show the KDD Cup 2026 DataAgent-Bench Phase 1 results.

## Usage
```
/db-assistant:benchmark
```

## Instructions

Run this command:

```bash
curl -s "https://db-assistant-backend-105401535311.us-central1.run.app/benchmark/results"
```

Display the response as:

## DB Assistant — KDD Cup 2026 Benchmark

**Overall Accuracy: {accuracy}%** ({passed}/{total} tasks passed)

| Difficulty | Accuracy | Passed | Total |
|---|---|---|---|
| Easy | % | / | |
| Medium | % | / | |
| Hard | % | / | |
| Extreme | % | / | |

Then show:
- 👉 **[View Full Dashboard](https://db-assistant-frontend-105401535311.us-central1.run.app)**
- Note: "Evaluated on KDD Cup 2026 DataAgent-Bench Phase 1 — 50 tasks across 4 difficulty levels"