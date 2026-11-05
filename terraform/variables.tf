variable "gcp_project" {
  description = "GCP project ID"
  type        = string
  default     = "donde-donar-422906"
}

variable "gcp_region" {
  description = "GCP region for all resources"
  type        = string
  default     = "europe-southwest1"
}

variable "github_owner" {
  description = "GitHub org/user that owns the repository"
  type        = string
  default     = "arredond"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "dondedonar"
}

variable "github_app_installation_id" {
  description = "Installation ID of the Cloud Build GitHub App on the repo's account (from https://github.com/settings/installations)"
  type        = number
}

variable "deploy_branch" {
  description = "Branch that triggers a build + deploy on push"
  type        = string
  default     = "main"
}

variable "job_name" {
  description = "Cloud Run Job name"
  type        = string
  default     = "hirudo-etl"
}

variable "scheduler_region" {
  description = "Region for the Cloud Scheduler job — Cloud Scheduler doesn't support gcp_region (europe-southwest1), so this picks the closest region that does."
  type        = string
  default     = "europe-west9" # Paris — closest Cloud Scheduler location to Madrid
}

variable "schedule" {
  description = "Cron schedule (Cloud Scheduler syntax, in schedule_timezone) for running the ETL"
  type        = string
  default     = "0 6 * * *" # Daily 06:00
}

variable "schedule_timezone" {
  description = "Timezone for the Cloud Scheduler cron schedule"
  type        = string
  default     = "Europe/Madrid"
}
