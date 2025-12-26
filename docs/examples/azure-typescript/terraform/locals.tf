locals {
  # Common tags/labels for all resources
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "azure-typescript"
  }
}

