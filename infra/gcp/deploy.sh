#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Default settings
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="marrymap"
API_SERVICE_NAME="marrymap-api"
WEB_SERVICE_NAME="marrymap-web"

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
echo -e "\n${BLUE}[1/5] Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com

# 4. Create Artifact Registry if not exists
echo -e "\n${BLUE}[2/5] Setting up Docker Artifact Registry...${NC}"
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
API_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${API_SERVICE_NAME}:latest"
WEB_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${WEB_SERVICE_NAME}:latest"

# 5. Build and submit images using Cloud Build
echo -e "\n${BLUE}[3/5] Building & pushing container images using Cloud Build...${NC}"

echo -e "${YELLOW}Building API container image...${NC}"
gcloud builds submit --tag "$API_IMAGE" apps/api

echo -e "${YELLOW}Building Web container image...${NC}"
gcloud builds submit --tag "$WEB_IMAGE" --file apps/web/Dockerfile .

# 6. Deploy API to Cloud Run
echo -e "\n${BLUE}[4/5] Deploying API to Cloud Run...${NC}"
echo -e "${YELLOW}Note: You can pass environment variables for the API via secret manager or env-vars.${NC}"

# Read API .env if it exists to help prefill environment variables
API_ENV_FILE="apps/api/.env"
API_ENV_FLAGS=""

if [ -f "$API_ENV_FILE" ]; then
    echo -e "Found API environment file at $API_ENV_FILE"
    # Parse and set environment flags, excluding comments/empty lines/PORT
    while IFS= read -r line || [ -n "$line" ]; do
        # Ignore comments and empty lines
        if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]] && [[ "$line" == *"="* ]]; then
            key=$(echo "$line" | cut -d '=' -f 1)
            val=$(echo "$line" | cut -d '=' -f 2-)
            # Don't set PORT dynamically; Cloud Run manages it
            if [ "$key" != "PORT" ] && [ "$key" != "HOST" ]; then
                API_ENV_FLAGS="${API_ENV_FLAGS}${key}=${val},"
            fi
        fi
    done < "$API_ENV_FILE"
    # Strip trailing comma
    API_ENV_FLAGS=${API_ENV_FLAGS%,}
fi

if [ -n "$API_ENV_FLAGS" ]; then
    echo -e "Deploying API with env vars from $API_ENV_FILE..."
    gcloud run deploy "$API_SERVICE_NAME" \
        --image "$API_IMAGE" \
        --region "$REGION" \
        --platform managed \
        --allow-unauthenticated \
        --set-env-vars "$API_ENV_FLAGS"
else
    echo -e "Deploying API with default configuration (please configure environment variables in GCP Console)..."
    gcloud run deploy "$API_SERVICE_NAME" \
        --image "$API_IMAGE" \
        --region "$REGION" \
        --platform managed \
        --allow-unauthenticated
fi

# Fetch API URL to pass to Web app
API_URL=$(gcloud run services describe "$API_SERVICE_NAME" --region="$REGION" --format='value(status.url)')
echo -e "${GREEN}API successfully deployed to: ${YELLOW}$API_URL${NC}"

# 7. Deploy Web App to Cloud Run
echo -e "\n${BLUE}[5/5] Deploying Web Frontend to Cloud Run...${NC}"

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
echo -e "${GREEN}Web URL: ${YELLOW}$WEB_URL${NC}"
echo -e "${GREEN}API URL: ${YELLOW}$API_URL${NC}"
echo -e "\n${YELLOW}Action Required:${NC} Remember to update your API's CORS_ORIGINS environment variable to include the Web URL: ${YELLOW}$WEB_URL${NC}"
