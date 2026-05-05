# DB Assistant — Claude Code Plugin

Query any database using natural language. Powered by Gemini 2.5 Flash + ReAct agents.

**SJSU CMPE 295B Master's Project** | KDD Cup 2026: **82% accuracy**

## Install

```bash
# Option 1: From local directory
/plugin load /path/to/db-assistant-plugin

# Option 2: From GitHub (after pushing)
/plugin marketplace add rutuja-patil24/database-assistant
/plugin install db-assistant@rutuja-patil24
```

## Commands

### Query your database
```
/db-assistant:query How many employees are in each department?
/db-assistant:query What is the total revenue by product?
/db-assistant:query Show me customers who spent more than $1000
```

Returns:
- Generated SQL
- Results preview
- **Clickable URL** to view full results page

### Check benchmark score
```
/db-assistant:benchmark
```

Shows KDD Cup 2026 accuracy: **82%**

## Live Demo
- Frontend: https://db-assistant-frontend-105401535311.us-central1.run.app
- API Docs: https://db-assistant-backend-105401535311.us-central1.run.app/docs
- Plugin manifest: https://db-assistant-backend-105401535311.us-central1.run.app/.well-known/ai-plugin.json