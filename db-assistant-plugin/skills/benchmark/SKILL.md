---
description: Show KDD Cup 2026 benchmark accuracy score for DB Assistant. Use when asked about benchmark, accuracy, or performance.
disable-model-invocation: true
allowed-tools: Bash
---

# DB Assistant Benchmark

Fetch and display the KDD Cup 2026 benchmark results.

## Instructions

Run this bash command:

```bash
curl -s "https://db-assistant-backend-105401535311.us-central1.run.app/benchmark/results"
```

Parse the JSON and display:
1. **Overall Accuracy** as a large heading
2. A table showing accuracy by difficulty (Easy/Medium/Hard/Extreme)
3. Total tasks passed vs total
4. Link to the dashboard: https://db-assistant-frontend-105401535311.us-central1.run.app