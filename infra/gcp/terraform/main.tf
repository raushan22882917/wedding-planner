terraform {
  required_version = ">= 1.3.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.50.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# List of Google Cloud APIs to enable
locals {
  gcp_services = [
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com"
  ]
}

# Enable APIs
resource "google_project_service" "services" {
  for_each           = toset(local.gcp_services)
  service            = each.key
  disable_on_destroy = false
}

# Artifact Registry Repository
resource "google_artifact_registry_repository" "marrymap_repo" {
  depends_on    = [google_project_service.services]
  location      = var.region
  repository_id = var.repository_name
  description   = "Docker Artifact Registry for MarryMap monorepo applications"
  format        = "DOCKER"
}

# Service Account for API
resource "google_service_account" "api_sa" {
  depends_on   = [google_project_service.services]
  account_id   = "marrymap-api-sa"
  display_name = "Service Account for MarryMap API Cloud Run"
}

# Service Account for Web
resource "google_service_account" "web_sa" {
  depends_on   = [google_project_service.services]
  account_id   = "marrymap-web-sa"
  display_name = "Service Account for MarryMap Web Cloud Run"
}

# Service Account for OpenWA
resource "google_service_account" "openwa_sa" {
  depends_on   = [google_project_service.services]
  account_id   = "marrymap-openwa-sa"
  display_name = "Service Account for MarryMap OpenWA Cloud Run"
}

# Cloud Run Service for API
resource "google_cloud_run_v2_service" "api_service" {
  name     = "marrymap-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api_sa.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.marrymap_repo.repository_id}/marrymap-api:latest"

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "PORT"
        value = "3000"
      }
      env {
        name  = "SUPABASE_URL"
        value = var.supabase_url
      }
      env {
        name  = "SUPABASE_SERVICE_ROLE_KEY"
        value = var.supabase_service_role_key
      }
      env {
        name  = "SUPABASE_AUTH_REQUIRED"
        value = "true"
      }
      env {
        name  = "RUN_WORKER"
        value = "true"
      }
      # CORS: to be updated after web service URL is known
      env {
        name  = "CORS_ORIGINS"
        value = "*"
      }
      env {
        name  = "OPENWA_BASE_URL"
        value = google_cloud_run_v2_service.openwa_service.uri
      }
      env {
        name  = "OPENWA_API_KEY"
        value = var.openwa_api_key
      }
      env {
        name  = "OPENWA_USE_LOCAL_GATEWAY"
        value = "false"
      }
    }
  }

  depends_on = [
    google_artifact_registry_repository.marrymap_repo,
    google_project_service.services,
    google_cloud_run_v2_service.openwa_service
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image
    ]
  }
}

# Cloud Run Service for OpenWA Gateway
resource "google_cloud_run_v2_service" "openwa_service" {
  name     = "marrymap-openwa"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.openwa_sa.email
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.marrymap_repo.repository_id}/marrymap-openwa:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
        cpu_idle = false
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "API_MASTER_KEY"
        value = var.openwa_api_key
      }
    }
  }

  depends_on = [
    google_artifact_registry_repository.marrymap_repo,
    google_project_service.services
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image
    ]
  }
}

# Cloud Run Service for Web Client
resource "google_cloud_run_v2_service" "web_service" {
  name     = "marrymap-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.web_sa.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.marrymap_repo.repository_id}/marrymap-web:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "SUPABASE_URL"
        value = var.supabase_url
      }
      env {
        name  = "SUPABASE_PUBLISHABLE_KEY"
        value = var.supabase_publishable_key
      }
      env {
        name  = "SUPABASE_PROJECT_ID"
        value = var.supabase_project_id
      }
      env {
        name  = "VITE_SUPABASE_URL"
        value = var.supabase_url
      }
      env {
        name  = "VITE_SUPABASE_PUBLISHABLE_KEY"
        value = var.supabase_publishable_key
      }
      env {
        name  = "VITE_SUPABASE_PROJECT_ID"
        value = var.supabase_project_id
      }
      env {
        name  = "SUPABASE_SERVICE_ROLE_KEY"
        value = var.supabase_service_role_key
      }
      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
      env {
        name  = "SEARCH_BACKEND_URL"
        value = google_cloud_run_v2_service.api_service.uri
      }
      env {
        name  = "RAZORPAY_KEY_ID"
        value = var.razorpay_key_id
      }
      env {
        name  = "RAZORPAY_KEY_SECRET"
        value = var.razorpay_key_secret
      }
      env {
        name  = "RAZORPAY_WEBHOOK_SECRET"
        value = var.razorpay_webhook_secret
      }
    }
  }

  depends_on = [
    google_cloud_run_v2_service.api_service,
    google_project_service.services
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image
    ]
  }
}

# IAM Policies to allow public access to both services
resource "google_cloud_run_v2_service_iam_member" "api_public_access" {
  name     = google_cloud_run_v2_service.api_service.name
  location = google_cloud_run_v2_service.api_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public_access" {
  name     = google_cloud_run_v2_service.web_service.name
  location = google_cloud_run_v2_service.web_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "openwa_public_access" {
  name     = google_cloud_run_v2_service.openwa_service.name
  location = google_cloud_run_v2_service.openwa_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
