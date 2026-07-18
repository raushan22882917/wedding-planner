variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "The Google Cloud region to deploy resources in"
  type        = string
  default     = "us-central1"
}

variable "repository_name" {
  description = "Name of the Artifact Registry repository"
  type        = string
  default     = "marrymap"
}

# Supabase Configurations
variable "supabase_url" {
  description = "Supabase API URL"
  type        = string
}

variable "supabase_service_role_key" {
  description = "Supabase service role key (sensitive)"
  type        = string
  sensitive   = true
}

variable "supabase_project_id" {
  description = "Supabase Project ID"
  type        = string
}

variable "supabase_publishable_key" {
  description = "Supabase Publishable Key"
  type        = string
}

# Gemini Configuration
variable "gemini_api_key" {
  description = "Gemini API Key"
  type        = string
  sensitive   = true
  default     = ""
}

# Razorpay Configuration (optional)
variable "razorpay_key_id" {
  description = "Razorpay Key ID"
  type        = string
  default     = ""
}

variable "razorpay_key_secret" {
  description = "Razorpay Key Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "razorpay_webhook_secret" {
  description = "Razorpay Webhook Secret"
  type        = string
  sensitive   = true
  default     = ""
}
