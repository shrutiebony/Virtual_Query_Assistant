# ── Backend Dockerfile ──────────────────────────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y libpq-dev gcc curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt requirements_auth.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements_auth.txt

COPY app/ ./app/
COPY benchmark_results.json ./benchmark_results.json

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
