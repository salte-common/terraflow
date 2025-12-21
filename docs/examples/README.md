# Terraflow Examples

This directory contains example configuration files for common Terraflow use cases.

## Example Configurations

- **aws-s3-secrets-manager.yml** - AWS setup with S3 backend and AWS Secrets Manager
- **azure-azurerm.yml** - Azure setup with AzureRM backend and Key Vault
- **gcp-gcs.yml** - GCP setup with GCS backend and Secret Manager
- **multi-environment.yml** - Multi-environment setup using workspace strategy
- **github-actions.yml** - GitHub Actions CI/CD integration example
- **gitlab-ci.yml** - GitLab CI/CD integration example

## Usage

1. Copy an example configuration file to `.tfwconfig.yml` in your Terraform project root:

```bash
cp docs/examples/aws-s3-secrets-manager.yml .tfwconfig.yml
```

2. Update the configuration with your specific values (bucket names, secret names, etc.)

3. Initialize Terraflow configuration:

```bash
terraflow config init
```

Or use the example directly after updating values:

```bash
cp docs/examples/aws-s3-secrets-manager.yml .tfwconfig.yml
# Edit .tfwconfig.yml with your values
terraflow plan
```

## Example Repository

For a complete working example, see the [terraflow-example](https://github.com/yourusername/terraflow-example) repository.

