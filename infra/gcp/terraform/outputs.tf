output "api_service_url" {
  description = "The URL of the deployed MarryMap API service"
  value       = google_cloud_run_v2_service.api_service.uri
}

output "web_service_url" {
  description = "The URL of the deployed MarryMap Web application"
  value       = google_cloud_run_v2_service.web_service.uri
}

output "artifact_registry_repository_url" {
  description = "The Artifact Registry Docker repository URL"
  value       = google_artifact_registry_repository.marrymap_repo.url
}
