<div align="center">

<img src="https://img.shields.io/badge/DB%20Assistant-AI%20Powered-4F46E5?style=for-the-badge&logo=database&logoColor=white" alt="DB Assistant"/>

# Database Assistant

### AI-Powered Natural Language Database Query System

**Query any database using plain English - no SQL knowledge required**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![Cloud Run](https://img.shields.io/badge/Google%20Cloud%20Run-Live-4285F4?style=flat-square&logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![KDD Cup](https://img.shields.io/badge/KDD%20Cup%202026-96%25%20Accuracy-10B981?style=flat-square)](https://kdd.org/kdd2026)

<br/>

[🌐 Live App](https://db-assistant-frontend-105401535311.us-central1.run.app) · [📖 API Docs](https://db-assistant-backend-105401535311.us-central1.run.app/docs) · [🔌 Plugin UI](https://db-assistant-backend-105401535311.us-central1.run.app/plugin-ui) · [📁 GitHub](https://github.com/rutuja-patil24/database-assistant)

<br/>

![DB Assistant Demo](https://img.shields.io/badge/Demo-Live%20on%20Cloud%20Run-4F46E5?style=for-the-badge)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [Architecture](#-architecture)
- [Agent Levels](#-agent-levels)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Benchmark Results](#-benchmark-results)
- [Open Claude Plugin](#-open-claude-plugin)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Team](#-team)

---

## 🎯 Overview

DB Assistant is a full-stack AI-powered system that enables **anyone** to query databases using plain English. Built for SJSU CMPE 295B Master's Project, it implements three levels of AI agent autonomy - from a basic single-pass query to a fully autonomous swarm of parallel specialized agents.

```
User: "What is the average salary by department?"
    ↓
DB Assistant: Reads schema → Generates SQL → Executes safely → Returns results + chart
    ↓
SELECT department, AVG(salary) FROM employees GROUP BY department
```

### Why DB Assistant?

| Problem | Solution |
|---|---|
| 80% of users cannot write SQL | Natural language interface |
| Data requests take days | Instant query execution |
| Complex schema knowledge required | AI-powered schema inspection |
| Multiple database types | Unified interface for 4 DB types |

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| 🖥️ **Web Application** | https://db-assistant-frontend-105401535311.us-central1.run.app |
| 📖 **API Documentation** | https://db-assistant-backend-105401535311.us-central1.run.app/docs |
| 🔌 **Plugin Web UI** | https://db-assistant-backend-105401535311.us-central1.run.app/plugin-ui |
| 📄 **Plugin Manifest** | https://db-assistant-backend-105401535311.us-central1.run.app/.well-known/ai-plugin.json |
| 🤖 **Agent Demos** | https://db-assistant-frontend-105401535311.us-central1.run.app/hello-world |
| 📊 **Benchmark Dashboard** | https://db-assistant-frontend-105401535311.us-central1.run.app/benchmark |

### Demo Database (Neon PostgreSQL)

```
postgresql://neondb_owner:npg_Rn56FbVsmiQI@ep-wandering-art-amtq6t2m-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require
```

| Table | Rows | Description |
|---|---|---|
| `employees` | 50 | Name, department, salary, city |
| `departments` | 10 | Name, budget, manager |
| `orders` | 200 | Product, quantity, revenue |
| `sales_performance` | 40 | Region, quarter, metrics |

---

## ✨ Features

### 🗄️ Multi-Database Support
- **PostgreSQL** - psycopg2 connector with live schema inspection
- **MySQL** - mysql-connector-python with SHOW TABLES schema reading
- **MongoDB** - pymongo/motor with collection sampling for schema inference
- **Supabase** - native PostgreSQL connector (zero additional backend code)

### 🤖 AI Agent Pipeline
- **Dynamic schema injection** - reads live database schema at query time
- **NL to SQL** - Gemini 2.5 Flash converts natural language to accurate SQL
- **Safety validation** - blocks SQL injection and destructive operations
- **Auto visualization** - bar, pie, line, area charts generated automatically

### 🔁 Three Agent Levels
- **L1 Basic** - single-pass query, fast, no error recovery
- **L2 ReAct** - self-correcting loop, up to 3 retry attempts with reasoning
- **L3 Swarm** - 4 parallel specialized agents with AI business insights

### 📊 Visualizations
- Multiple chart types generated simultaneously (collage view)
- Auto-selection logic based on result column types
- Recharts integration with responsive containers

### 📁 Dataset Upload
- CSV upload with Papa.parse browser parsing
- Excel support via SheetJS
- In-memory SQLite querying on uploaded data

### 🔌 Open Claude Plugin
- Plugin manifest at `/.well-known/ai-plugin.json`
- Web UI with Demo DB, Connect DB, and CLI tabs
- Shareable result URLs (`/results/{id}`)
- Claude Code CLI integration with 3 custom skills

### 🔒 Security
- JWT authentication with 24-hour token expiry
- AES-256 Fernet encryption for connection strings
- bcrypt password hashing
- CORS policy with origin allowlist

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REACT 18 FRONTEND                        │
│   Login · Dashboard · Query · Swarm · Benchmark · Plugin    │
│              Agent Demos (L1/L2/L3)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API (JSON)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (46 endpoints)                 │
│       JWT Auth · AES-256 Encryption · Async handlers        │
└──────┬──────────┬──────────┬───────────┬────────────────────┘
       │          │          │           │
   PostgreSQL   MySQL    MongoDB     Supabase
   Cloud SQL                          (via PG)
       │
┌──────▼──────────────────────────────────────────────────────┐
│                  AI AGENT PIPELINE                          │
│  L1: Schema → Gemini → SQL → Safety → Execute → Visualize   │
│  L2: ReAct Loop (Think → Act → Observe → Repeat)            │
│  L3: Schema Agent ║ SQL Agent ║ Safety Agent ║ Insight Agent│
│              Powered by Google Gemini 2.5 Flash             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 Agent Levels

### Level 1 - Basic Agent
```
Question → Schema Inspector → Gemini 2.5 Flash → SQL → Safety Check → Execute → Result
```
Single pass, no retry. Fast and simple. Best for straightforward queries.

### Level 2 - ReAct Agent
```
Question → Think 💭 → Generate SQL ⚡ → Execute 🔄
              ↑                              ↓
              └──── Reason about error ←- Error?
                                        → Success ✓
```
Reads its own errors, reasons about the cause, generates corrected SQL. Up to 3 attempts.

### Level 3 - Swarm Agent
```
                    Question
                       ↓
          ┌────────────────────────┐
          │    Coordinator Agent   │
          └────────────────────────┘
                       ↓
    ┌──────────┬──────────┬──────────┬──────────┐
    ↓          ↓          ↓          ↓
Schema      SQL         Safety    Insight
Agent       Agent       Agent     Agent
(reads DB)  (ReAct      (checks   (generates
            loop)       security) insight)
    └──────────┴──────────┴──────────┴──────────┘
                       ↓
          ┌────────────────────────┐
          │  Final Answer + Insight│
          └────────────────────────┘
```
Four specialized agents run in parallel via `asyncio.gather`. Best accuracy and richest output.

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| Recharts | Latest | Data visualizations |
| Lucide React | Latest | Icons |
| Papa Parse | Latest | CSV parsing |
| SheetJS | Latest | Excel parsing |
| JWT localStorage | — | Auth token storage |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | Latest | REST API framework |
| Python | 3.11 | Runtime |
| psycopg2 | Latest | PostgreSQL connector |
| mysql-connector-python | Latest | MySQL connector |
| pymongo + motor | Latest | MongoDB connectors |
| google-generativeai | Latest | Gemini AI SDK |
| python-jose | Latest | JWT tokens |
| cryptography (Fernet) | Latest | AES-256 encryption |
| bcrypt | Latest | Password hashing |

### Infrastructure
| Technology | Purpose |
|---|---|
| Google Cloud Run | Serverless container deployment |
| Cloud SQL PostgreSQL 15 | Production database |
| Google Artifact Registry | Docker image storage |
| Cloud Build | CI/CD pipeline |
| Neon PostgreSQL | Demo database (serverless) |
| Docker | Containerization |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop
- Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/rutuja-patil24/database-assistant.git
cd database-assistant
```

### 2. Create virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\Activate.ps1

# Mac/Linux
source .venv/bin/activate
```

### 3. Start local PostgreSQL

```bash
cd infra
docker-compose up -d
cd ..
```

### 4. Start the backend

```bash
cd backend
pip install -r requirements.txt
$env:GEMINI_API_KEY = "your-gemini-api-key"
python -m uvicorn app.main:app --port 8000
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### 5. Start the frontend

```bash
cd frontend
npm install
$env:REACT_APP_API_URL = "http://localhost:8000"
npm start
```

Frontend runs at: `http://localhost:3000`

---

## ⚙️ Environment Variables

### Backend (.env)

```env
# AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# Database (local)
DB_HOST=localhost
DB_PORT=5433
DB_NAME=da_db
DB_USER=da_user
DB_PASS=your-password

# Security
ENCRYPTION_KEY=your-fernet-key
JWT_SECRET=your-jwt-secret

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

Generate a Fernet key:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:8000
```

---

## 📡 API Reference

### Authentication
```
POST /auth/register    — Create new account
POST /auth/login       — Login, receive JWT token
GET  /auth/me          — Get current user
```

### PostgreSQL Queries
```
POST /pg/nl-query-auto — NL query with optional ReAct loop
POST /pg/list-tables   — List all tables in schema
POST /pg/describe-table — Get column details
```

### MySQL Queries
```
POST /mysql/nl-query       — Basic NL query
POST /mysql/nl-query-auto  — NL query with ReAct loop
POST /mysql/test-connection — Test connection
```

### MongoDB Queries
```
POST /mongo/nl-query         — Basic NL query
POST /mongo/nl-query-auto    — NL query with ReAct loop
POST /mongo/list-collections — List all collections
```

### Swarm Agents
```
POST /swarm/pg-query — Run 4-agent swarm on PostgreSQL
```

### Datasets
```
POST /my-datasets/benchmark-run — Query uploaded CSV/Excel tables
```

### Plugin
```
GET  /.well-known/ai-plugin.json — Plugin manifest
POST /plugin/query               — NL query via plugin
POST /plugin/connect             — Test database connection
GET  /results/{id}               — Shareable result page
GET  /plugin-ui                  — Plugin web interface
```

### Benchmark
```
GET /benchmark/results — Full KDD Cup 2026 benchmark results
```

### System
```
GET /health    — Health check
GET /db/ping   — PostgreSQL ping
GET /mongo/ping — MongoDB ping
GET /docs      — Swagger UI (46 endpoints)
```

---

## 📊 Benchmark Results

Evaluated on **KDD Cup 2026 DataAgent-Bench Phase 1** — 50 tasks across 4 difficulty levels.

| Metric | Result |
|---|---|
| **Overall Accuracy** | **96.0%** |
| Tasks Passed | 48 / 50 |
| Self-Corrected | 12 tasks (100% success) |
| Average Response Time | 11.2 seconds |

| Difficulty | Tasks | Passed | Accuracy |
|---|---|---|---|
| Easy | 15 | 14 | **96.3%** |
| Medium | 23 | 22 | **95.9%** |
| Hard | 10 | 10 | **100.0%** |
| Extreme | 2 | 2 | **100.0%** |

### Accuracy Progression

```
Initial baseline:  46% ████░░░░░░
After type fixes:  62% ██████░░░░
After lang hints:  71% ███████░░░
After time fixes:  77% ████████░░
Final result:      96% █████████░
```

### Running the Benchmark

```bash
cd backend

# Full run (all 50 tasks, ~30 minutes)
python benchmark_agent.py \
  --data_path "path/to/demo_samples/public" \
  --limit 52 \
  --output benchmark_results.json

# Retry failed tasks only (~10 minutes)
python benchmark_agent.py \
  --retry \
  --data_path "path/to/demo_samples/public" \
  --results_path benchmark_results.json \
  --output benchmark_results.json
```

---

## 🔌 Open Claude Plugin

### Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

### Load the Plugin

```bash
cd database-assistant
claude --plugin-dir ./db-assistant-plugin
```

### Available Skills

```bash
# Query the demo database
/db-assistant:query How many employees are in each department?

# Connect your own database
/db-assistant:connect postgresql://user:pass@host/db

# Show benchmark accuracy
/db-assistant:benchmark
```

### Plugin Manifest

```json
{
  "schema_version": "v1",
  "name_for_human": "DB Assistant",
  "name_for_model": "db_assistant",
  "description_for_human": "Query any database using natural language.",
  "auth": { "type": "none" },
  "api": {
    "type": "openapi",
    "url": "https://db-assistant-backend-105401535311.us-central1.run.app/openapi.json"
  }
}
```

---

## ☁️ Deployment

### Deploy Backend to Cloud Run

```bash
cd backend

# Build and push image
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/database-assistant/db-assistant/db-assistant-backend:latest \
  . --project database-assistant

# Deploy
gcloud run deploy db-assistant-backend \
  --image=us-central1-docker.pkg.dev/database-assistant/db-assistant/db-assistant-backend:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --add-cloudsql-instances=database-assistant:us-central1:db-assistant-pg \
  --set-env-vars="DB_HOST=/cloudsql/database-assistant:us-central1:db-assistant-pg,\
DB_NAME=da_db,DB_USER=da_user,DB_PASS=your-password,\
GEMINI_API_KEY=your-key,GEMINI_MODEL=gemini-2.5-flash,\
ENCRYPTION_KEY=your-fernet-key,JWT_SECRET=your-jwt-secret,\
ALLOWED_ORIGINS=https://your-frontend.run.app"
```

### Deploy Frontend to Cloud Run

```bash
cd frontend

# Build image
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/database-assistant/db-assistant/frontend:latest \
  . --project database-assistant

# Deploy
gcloud run deploy db-assistant-frontend \
  --image=us-central1-docker.pkg.dev/database-assistant/db-assistant/frontend:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1
```

---

## 📁 Project Structure

```
database-assistant/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py           # JWT authentication
│   │   │       ├── pg_query.py       # PostgreSQL NL queries
│   │   │       ├── mysql_routes.py   # MySQL NL queries
│   │   │       ├── mongo.py          # MongoDB NL queries
│   │   │       ├── swarm.py          # Swarm agent execution
│   │   │       ├── internal_datasets.py # CSV upload queries
│   │   │       ├── benchmark.py      # Benchmark results
│   │   │       ├── plugin.py         # Open Claude Plugin
│   │   │       ├── ai_functions.py   # AI functions (generate, if, rank)
│   │   │       └── genui.py          # Generative UI engine
│   │   ├── agents/
│   │   │   ├── pg_nl_to_sql_agent.py # NL to SQL agent
│   │   │   └── pg_safety_agent.py    # Safety validation agent
│   │   ├── services/
│   │   │   ├── nl_to_sql.py          # ReAct loop implementation
│   │   │   ├── mysql_service.py      # MySQL service
│   │   │   └── mongo_service.py      # MongoDB service
│   │   ├── db.py                     # Database connection
│   │   └── main.py                   # FastAPI application
│   ├── benchmark_agent.py            # KDD Cup benchmark runner
│   ├── benchmark_results.json        # Latest benchmark results
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── PostgresPage.jsx
│   │   │   ├── MySQLPage.jsx
│   │   │   ├── MongoPage.jsx
│   │   │   ├── SupabasePage.jsx
│   │   │   ├── DatasetsPage.jsx
│   │   │   ├── ConnectionsPage.jsx
│   │   │   ├── SwarmPage.jsx
│   │   │   ├── BenchmarkDashboard.jsx
│   │   │   └── HelloWorldPage.jsx    # L1/L2/L3 agent demos
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx
│   │   │   │   └── AppLayout.css
│   │   │   └── PluginPage.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   └── App.jsx
│   ├── Dockerfile
│   └── nginx.conf
├── db-assistant-plugin/
│   ├── .claude-plugin/
│   │   └── plugin.json
│   └── skills/
│       ├── query/SKILL.md
│       ├── connect/SKILL.md
│       └── benchmark/SKILL.md
├── infra/
│   └── docker-compose.yml
└── README.md
```

---




<div align="center">

**DB Assistant** — SJSU CMPE 295B Master's Project · 2026

[![Made with FastAPI](https://img.shields.io/badge/Made%20with-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini%202.5-4285F4?style=flat-square&logo=google)](https://ai.google.dev)
[![Deployed on Cloud Run](https://img.shields.io/badge/Deployed%20on-Cloud%20Run-4285F4?style=flat-square&logo=googlecloud)](https://cloud.google.com/run)

</div>
