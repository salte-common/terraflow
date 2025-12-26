terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    # Backend configuration provided via:
    # - terraflow CLI flags
    # - environment variables (TERRAFLOW_*)
    # - .tfwconfig.yml
    # 
    # Do not hardcode values here
  }
}

provider "aws" {
  region = var.aws_region
}

