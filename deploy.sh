#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  DB Assistant — Google Cloud Run Deployment Script
#  SJSU CMPE 295B — Siri Batchu, Shruti Goyal, Rutuja Patil, Aditya R
# ═══════════════════════════════════════════════════════════════════
set -e

# ── CONFIG — edit these ──────────────────────────────────────────────
PROJECT_ID="database-assistant"        # your GCP project ID
REGION="us-central1"
BACKEND_SERVICE="db-assistant-backend"
FRONTEND_SERVICE="db-assistant-frontend"

# Cloud SQL (PostgreSQL) instance name
DB_INSTANCE="db-assistant-pg"
DB_NAME="da_db"
DB_USER="da_user"
DB_PASS="da_pass_prod_change_me"

# Gemini API key
GEMINI_KEY="AIzaSyBJWZtmqPxTEs7SjQ3Kr-FWoo6RBcXmaPQ"
ENCRYPTION_KEY="your-32-char-encryption-key-here"
JWT_SECRET="your-jwt-secret-here"
# ────────────────────────────────────────────────────────────────────

echo "🚀 DB Assistant Cloud Run Deployment"
echo "Project: $PROJECT_ID | Region: $REGION"
echo ""

# Step 1 — Set GCP project
echo "📋 Step 1: Setting GCP project..."
gcloud config set project $PROJECT_ID
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com

# Step 2 — Create Artifact Registry repo
echo "📦 Step 2: Creating Artifact Registry..."
gcloud artifacts repositories create db-assistant \
    --repository-format=docker \
    --location=$REGION \
    --description="DB Assistant images" 2>/dev/null || true

REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/db-assistant"

# Step 3 — Create Cloud SQL PostgreSQL instance
echo "🗄️  Step 3: Creating Cloud SQL PostgreSQL instance..."
gcloud sql instances create $DB_INSTANCE \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --storage-size=10GB \
    --no-backup 2>/dev/null || echo "Instance already exists"

gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE 2>/dev/null || true
gcloud sql users create $DB_USER --instance=$DB_INSTANCE --password=$DB_PASS 2>/dev/null || true

DB_CONNECTION_NAME="$PROJECT_ID:$REGION:$DB_INSTANCE"
echo "   DB Connection: $DB_CONNECTION_NAME"

# Step 4 — Store secrets in Secret Manager
echo "🔐 Step 4: Storing secrets..."
echo -n "$GEMINI_KEY"     | gcloud secrets create GEMINI_API_KEY --data-file=- 2>/dev/null || \
echo -n "$GEMINI_KEY"     | gcloud secrets versions add GEMINI_API_KEY --data-file=-
echo -n "$ENCRYPTION_KEY" | gcloud secrets create ENCRYPTION_KEY --data-file=- 2>/dev/null || \
echo -n "$ENCRYPTION_KEY" | gcloud secrets versions add ENCRYPTION_KEY --data-file=-
echo -n "$JWT_SECRET"     | gcloud secrets create JWT_SECRET --data-file=- 2>/dev/null || \
echo -n "$JWT_SECRET"     | gcloud secrets versions add JWT_SECRET --data-file=-
echo -n "$DB_PASS"        | gcloud secrets create DB_PASS --data-file=- 2>/dev/null || \
echo -n "$DB_PASS"        | gcloud secrets versions add DB_PASS --data-file=-

# Step 5 — Build and push backend image
echo "🔨 Step 5: Building backend Docker image..."
cd backend
docker build -t $REGISTRY/$BACKEND_SERVICE:latest .
docker push $REGISTRY/$BACKEND_SERVICE:latest
cd ..

# Step 6 — Deploy backend to Cloud Run
echo "☁️  Step 6: Deploying backend to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE \
    --image=$REGISTRY/$BACKEND_SERVICE:latest \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=2Gi \
    --cpu=2 \
    --min-instances=0 \
    --max-instances=10 \
    --timeout=300 \
    --add-cloudsql-instances=$DB_CONNECTION_NAME \
    --set-env-vars="DB_HOST=/cloudsql/$DB_CONNECTION_NAME" \
    --set-env-vars="DB_NAME=$DB_NAME" \
    --set-env-vars="DB_USER=$DB_USER" \
    --set-env-vars="DB_PORT=5432" \
    --set-env-vars="GEMINI_MODEL=gemini-2.5-flash" \
    --update-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
    --update-secrets="ENCRYPTION_KEY=ENCRYPTION_KEY:latest" \
    --update-secrets="JWT_SECRET=JWT_SECRET:latest" \
    --update-secrets="DB_PASS=DB_PASS:latest"

# Get backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE \
    --region=$REGION --format='value(status.url)')
echo "   ✅ Backend deployed: $BACKEND_URL"

# Step 7 — Build and push frontend image
echo "🔨 Step 7: Building frontend Docker image..."
cd frontend
docker build \
    --build-arg REACT_APP_API_URL=$BACKEND_URL \
    -t $REGISTRY/$FRONTEND_SERVICE:latest \
    -f Dockerfile .
docker push $REGISTRY/$FRONTEND_SERVICE:latest
cd ..

# Step 8 — Deploy frontend to Cloud Run
echo "☁️  Step 8: Deploying frontend to Cloud Run..."
gcloud run deploy $FRONTEND_SERVICE \
    --image=$REGISTRY/$FRONTEND_SERVICE:latest \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=5

FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE \
    --region=$REGION --format='value(status.url)')
echo "   ✅ Frontend deployed: $FRONTEND_URL"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════════"
echo "  Frontend : $FRONTEND_URL"
echo "  Backend  : $BACKEND_URL"
echo "  Backend Health: $BACKEND_URL/health"
echo "═══════════════════════════════════════════════════════"