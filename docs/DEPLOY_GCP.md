# Google Cloud Platform Deployment Guide

This guide walks you through deploying the MarryMap monorepo application to **Google Cloud Platform (GCP)** using **Google Cloud Run** and **Artifact Registry**.

---

## Architecture Overview

- **MarryMap Web Frontend (`apps/web`):** Containerized TanStack Start SSR application running on Cloud Run.
- **MarryMap Search & Fetch API (`apps/api`):** Containerized Fastify application running on Cloud Run.
- **Artifact Registry:** Hosts the Docker images for both applications.
- **Database & Auth:** Provided by your external **Supabase** instance.

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
3. Builds both application images locally or via Cloud Build.
4. Reads configurations from your local `.env` files (`apps/api/.env` and `apps/web/.env`) and configures them as environment variables on Cloud Run.
5. Dynamically captures the deployed API service URL and assigns it as `SEARCH_BACKEND_URL` for the Web frontend.

### Steps:

1. **Verify your local environment files:**
   Ensure you have setup:
   - `apps/api/.env` (contains `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)
   - `apps/web/.env` (contains `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, etc.)

2. **Execute the script:**
   Ensure you run the script from the repository root:
   ```bash
   ./infra/gcp/deploy.sh
   ```

   *Note: You can override the deployment region by running `GCP_REGION=your-region ./infra/gcp/deploy.sh` (defaults to `us-central1`).*

---

## Option B: Infrastructure-as-Code (Terraform)

For professional infrastructure management, we check-in Terraform files under [infra/gcp/terraform/](file:///Users/raushankumar/Documents/wedding-planner/infra/gcp/terraform/).

### Steps:

1. **Prepare Docker Images:**
   Terraform configures Cloud Run, but expects the images to exist in the registry. Build and push them using Cloud Build or your CI/CD runner first:
   ```bash
   # Set environment variables
   PROJECT_ID="your-gcp-project-id"
   REGION="us-central1"
   REPO_NAME="marrymap"
   
   # Enable registry
   gcloud services enable artifactregistry.googleapis.com
   
   # Create registry repository
   gcloud artifacts repositories create $REPO_NAME \
       --repository-format=docker \
       --location=$REGION
   
   # Build API and Web images
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
- **Supabase Console:** Update your Supabase Auth allowed redirect URLs to include your Web App URL to ensure authentication redirects work correctly.

### 2. Custom Domains (Optional)
Cloud Run allows you to map custom domains directly to your services.
Go to the Cloud Run dashboard, click on **Manage Custom Domains**, and follow the instructions to configure DNS records.
