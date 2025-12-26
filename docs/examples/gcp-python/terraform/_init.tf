terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    # Backend configuration provided via terraflow
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

