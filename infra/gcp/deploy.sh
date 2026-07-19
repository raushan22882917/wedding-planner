#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Default settings
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="marrymap"
OPENWA_SERVICE_NAME="marrymap-openwa"
API_SERVICE_NAME="wedding-planner-api"
WEB_SERVICE_NAME="wedding-planner-git"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MarryMap Google Cloud Run Deployer ===${NC}\n"

# 1. Check gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# 2. Get active project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}No active Google Cloud project set.${NC}"
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    if [ -z "$PROJECT_ID" ]; then
        echo -e "${RED}Project ID cannot be empty.${NC}"
        exit 1
    fi
    gcloud config set project "$PROJECT_ID"
else
    echo -e "${GREEN}Using active Google Cloud project: ${YELLOW}$PROJECT_ID${NC}"
fi

# 3. Enable GCP Services
echo -e "\n${BLUE}[1/6] Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com

# 4. Create Artifact Registry if not exists
echo -e "\n${BLUE}[2/6] Setting up Docker Artifact Registry...${NC}"
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
    echo -e "Creating repository '$REPO_NAME' in '$REGION'..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker repository for MarryMap"
else
    echo -e "Repository '$REPO_NAME' already exists in '$REGION'."
fi

# Docker image tags
OPENWA_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${OPENWA_SERVICE_NAME}:latest"
API_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${API_SERVICE_NAME}:latest"
WEB_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${WEB_SERVICE_NAME}:latest"

# 5. Build and submit images using Cloud Build
echo -e "\n${BLUE}[3/6] Building & pushing container images using Cloud Build...${NC}"

echo -e "${YELLOW}Building OpenWA container image...${NC}"
gcloud builds submit --tag "$OPENWA_IMAGE" apps/openwa

echo -e "${YELLOW}Building API container image...${NC}"
gcloud builds submit --tag "$API_IMAGE" apps/api

echo -e "${YELLOW}Building Web container image...${NC}"
gcloud builds submit --tag "$WEB_IMAGE" .

# 6. Deploy OpenWA to Cloud Run
echo -e "\n${BLUE}[4/6] Deploying OpenWA to Cloud Run...${NC}"
echo -e "${YELLOW}Configuring OpenWA with always-on CPU, 2 vCPUs, and 2GiB memory...${NC}"

# Extract or generate OPENWA_API_KEY
OPENWA_API_KEY=""
if [ -f ".env" ]; then
    OPENWA_API_KEY=$(grep -E "^OPENWA_API_KEY=" .env | head -n 1 | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
fi
if [ -z "$OPENWA_API_KEY" ] && [ -f "apps/api/.env" ]; then
    OPENWA_API_KEY=$(grep -E "^OPENWA_API_KEY=" apps/api/.env | head -n 1 | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
fi
if [ -z "$OPENWA_API_KEY" ]; then
    echo -e "${YELLOW}OPENWA_API_KEY not found in environment files. Generating a secure random key...${NC}"
    OPENWA_API_KEY=$(openssl rand -hex 32)
fi

# A single linked WhatsApp account owns live WebSocket/Chromium state. Do not
# let Cloud Run route requests to a second independent session store.
gcloud run deploy "$OPENWA_SERVICE_NAME" \
    --image "$OPENWA_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --no-cpu-throttling \
    --min-instances 1 \
    --max-instances 1 \
    --cpu 2 \
    --memory 2Gi \
    --execution-environment gen2 \
    --set-env-vars "API_MASTER_KEY=${OPENWA_API_KEY},NODE_ENV=production"

OPENWA_URL=$(gcloud run services describe "$OPENWA_SERVICE_NAME" --region="$REGION" --format='value(status.url)')
echo -e "${GREEN}OpenWA successfully deployed to: ${YELLOW}$OPENWA_URL${NC}"
echo -e "${YELLOW}OpenWA is pinned to one warm instance. For durable sessions across a revision or instance replacement, host OpenWA on persistent POSIX storage (for example a VM persistent disk or Filestore); Cloud Run's container filesystem is ephemeral.${NC}"

# 7. Deploy API to Cloud Run
echo -e "\n${BLUE}[5/6] Deploying API to Cloud Run...${NC}"

# Read API .env if it exists to help prefill environment variables
API_ENV_FILE="apps/api/.env"
API_ENV_FLAGS=""

if [ -f "$API_ENV_FILE" ]; then
    echo -e "Found API environment file at $API_ENV_FILE"
    # Parse and set environment flags, excluding comments/empty lines/PORT/OPENWA overrides
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]] && [[ "$line" == *"="* ]]; then
            key=$(echo "$line" | cut -d '=' -f 1)
            val=$(echo "$line" | cut -d '=' -f 2-)
            if [ "$key" != "PORT" ] && [ "$key" != "HOST" ] && [ "$key" != "OPENWA_BASE_URL" ] && [ "$key" != "OPENWA_API_KEY" ] && [ "$key" != "OPENWA_USE_LOCAL_GATEWAY" ]; then
                API_ENV_FLAGS="${API_ENV_FLAGS}${key}=${val},"
            fi
        fi
    done < "$API_ENV_FILE"
    API_ENV_FLAGS=${API_ENV_FLAGS%,}
fi

# Append dynamically resolved OpenWA values
if [ -n "$API_ENV_FLAGS" ]; then
    API_ENV_FLAGS="${API_ENV_FLAGS},OPENWA_BASE_URL=${OPENWA_URL},OPENWA_API_KEY=${OPENWA_API_KEY},OPENWA_USE_LOCAL_GATEWAY=false"
else
    API_ENV_FLAGS="OPENWA_BASE_URL=${OPENWA_URL},OPENWA_API_KEY=${OPENWA_API_KEY},OPENWA_USE_LOCAL_GATEWAY=false"
fi

echo -e "Deploying API with merged env vars and linking OpenWA gateway..."
gcloud run deploy "$API_SERVICE_NAME" \
    --image "$API_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "$API_ENV_FLAGS"

# Fetch API URL to pass to Web app
API_URL=$(gcloud run services describe "$API_SERVICE_NAME" --region="$REGION" --format='value(status.url)')
echo -e "${GREEN}API successfully deployed to: ${YELLOW}$API_URL${NC}"

# 8. Deploy Web App to Cloud Run
echo -e "\n${BLUE}[6/6] Deploying Web Frontend to Cloud Run...${NC}"

# Read Web .env if it exists
WEB_ENV_FILE="apps/web/.env"
WEB_ENV_FLAGS="SEARCH_BACKEND_URL=${API_URL}"

if [ -f "$WEB_ENV_FILE" ]; then
    echo -e "Found Web environment file at $WEB_ENV_FILE"
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]] && [[ "$line" == *"="* ]]; then
            key=$(echo "$line" | cut -d '=' -f 1)
            val=$(echo "$line" | cut -d '=' -f 2-)
            if [ "$key" != "PORT" ] && [ "$key" != "SEARCH_BACKEND_URL" ]; then
                WEB_ENV_FLAGS="${WEB_ENV_FLAGS},${key}=${val}"
            fi
        fi
    done < "$WEB_ENV_FILE"
fi

echo -e "Deploying Web Frontend linking to API at $API_URL..."
gcloud run deploy "$WEB_SERVICE_NAME" \
    --image "$WEB_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "$WEB_ENV_FLAGS"

WEB_URL=$(gcloud run services describe "$WEB_SERVICE_NAME" --region="$REGION" --format='value(status.url)')

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "${GREEN}Web URL:      ${YELLOW}$WEB_URL${NC}"
echo -e "${GREEN}API URL:      ${YELLOW}$API_URL${NC}"
echo -e "${GREEN}OpenWA URL:   ${YELLOW}$OPENWA_URL${NC}"
echo -e "\n${YELLOW}Action Required:${NC} Remember to update your API's CORS_ORIGINS environment variable to include the Web URL: ${YELLOW}$WEB_URL${NC}"
