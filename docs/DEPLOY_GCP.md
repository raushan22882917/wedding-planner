# Google Cloud Platform Deployment Guide

This guide walks you through deploying the MarryMap monorepo applications to **Google Cloud Platform (GCP)** using **Google Cloud Run** and **Artifact Registry**.

---

## Architecture Overview

- **MarryMap Web Frontend (`apps/web`):** Containerized TanStack Start SSR application running on Cloud Run.
- **MarryMap Search & Fetch API (`apps/api`):** Containerized Fastify application running on Cloud Run.
- **MarryMap OpenWA Gateway (`apps/openwa`):** NestJS API/dashboard serving as the WhatsApp Web automation server.
- **Artifact Registry:** Hosts the Docker images for all three applications.
- **Database & Auth:** Provided by your external **Supabase** instance.

---

## OpenWA Cloud Run Requirements

Due to WhatsApp Web's automation running Chromium (Puppeteer), the `marrymap-openwa` container has strict Cloud Run limits:
1. **Always-On CPU:** The service must be deployed with `--no-cpu-throttling` (`cpu_idle = false` in Terraform). If CPU is only allocated during request processing, the WebSocket connection with WhatsApp will drop when the app is idle.
2. **Resource Limits:** Minimum `2 vCPUs` and `2GiB` memory limits are configured to prevent Chromium out-of-memory crashes.
3. **Execution Environment:** Set to `gen2` to support the full Linux syscall set required by Chromium sandboxing.

---

## Prerequisites

1. **Google Cloud SDK (`gcloud` CLI):** Installed and authenticated on your local machine.
   ```bash
   gcloud auth login
   gcloud auth configure-docker us-central1-docker.pkg.dev
   ```
2. **GCP Project:** An active GCP project with billing enabled.
3. **Supabase Project:** A configured project with URL, publishable key, and service role key.

---

## Option A: Automated Scripted Deployment (Recommended)

We provide a deployment script at [deploy.sh](file:///Users/raushankumar/Documents/wedding-planner/infra/gcp/deploy.sh) that:
1. Enables necessary Google Cloud APIs.
2. Creates an Artifact Registry repository.
3. Builds the OpenWA, API, and Web client container images via Cloud Build.
4. Deploys the `marrymap-openwa` service with 2 vCPUs, 2GiB RAM, execution environment `gen2`, and disabled CPU throttling.
5. Captures the deployed OpenWA URL and deploys the `marrymap-api` service, linking the URL and key configuration.
6. Captures the API URL and deploys the `marrymap-web` frontend service.

### Steps:

1. **Verify your local environment files:**
   Ensure you have setup `.env` in the monorepo root containing keys like `SUPABASE_URL` and `OPENWA_API_KEY`.
2. **Execute the script:**
   Run from the repository root:
   ```bash
   ./infra/gcp/deploy.sh
   ```

   *Note: You can override the deployment region by running `GCP_REGION=your-region ./infra/gcp/deploy.sh` (defaults to `us-central1`).*

---

## Option B: Infrastructure-as-Code (Terraform)

For professional infrastructure management, we check-in Terraform files under [infra/gcp/terraform/](file:///Users/raushankumar/Documents/wedding-planner/infra/gcp/terraform/).

### Steps:

1. **Prepare Docker Images:**
   Build and push the three images to your Artifact Registry repository first:
   ```bash
   PROJECT_ID="your-gcp-project-id"
   REGION="us-central1"
   REPO_NAME="marrymap"
   
   # Enable registry
   gcloud services enable artifactregistry.googleapis.com
   
   # Create registry repository
   gcloud artifacts repositories create $REPO_NAME \
       --repository-format=docker \
       --location=$REGION
   
   # Build images
   gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/marrymap-openwa:latest apps/openwa
   gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/marrymap-api:latest apps/api
   gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/marrymap-web:latest --file apps/web/Dockerfile .
   ```

2. **Configure Terraform Variables:**
   Create a `terraform.tfvars` file under `infra/gcp/terraform/`:
   ```hcl
   project_id                = "your-gcp-project-id"
   region                    = "us-central1"
   supabase_url              = "https://your-supabase-project.supabase.co"
   supabase_service_role_key = "your-supabase-service-role-key"
   supabase_project_id       = "your-supabase-project-id"
   supabase_publishable_key  = "your-supabase-anon-key"
   openwa_api_key            = "your-secure-openwa-token"
   gemini_api_key            = "your-gemini-key" # Optional
   ```

3. **Initialize and Apply Terraform:**
   ```bash
   cd infra/gcp/terraform
   terraform init
   terraform plan
   terraform apply
   ```

---

## Post-Deployment Checklist

### 1. Configure CORS
Once the Web frontend URL is generated (e.g. `https://marrymap-web-xxxxx-uc.a.run.app`), update the **CORS** configurations:
- **API Cloud Run Service:** Update the `CORS_ORIGINS` environment variable to include your Web App URL.
- **Supabase Console:** Update your Supabase Auth allowed redirect URLs to include your Web App URL.

### 2. Custom Domains (Optional)
Cloud Run allows you to map custom domains directly to your services.
Go to the Cloud Run dashboard, click on **Manage Custom Domains**, and follow the instructions to configure DNS records.
