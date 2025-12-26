# Terraflow CLI

[![CI](https://github.com/salte-common/terraflow/workflows/CI/badge.svg)](https://github.com/salte-common/terraflow/actions)
[![codecov](https://codecov.io/gh/salte-common/terraflow/branch/main/graph/badge.svg)](https://codecov.io/gh/salte-common/terraflow)
[![npm version](https://badge.fury.io/js/terraflow.svg)](https://badge.fury.io/js/terraflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An opinionated Node.js CLI wrapper for Terraform that provides intelligent workspace management, multi-cloud backend support, secrets integration, and git-aware workflows.

## Features

- 🎯 **Intelligent Workspace Management** - Automatically derives workspace names from git context (branch, tag, or hostname)
- ☁️ **Multi-Cloud Backend Support** - AWS S3, Azure RM, and GCP GCS backends with automatic configuration
- 🔐 **Secrets Integration** - Supports AWS Secrets Manager, Azure Key Vault, and GCP Secret Manager
- 🔑 **Authentication Plugins** - AWS IAM roles, Azure service principals, and GCP service accounts
- 📝 **Git-Aware Workflows** - Automatically detects git repository context and validates working directory state
- ⚙️ **Configuration Management** - Hierarchical configuration with environment variable support and template variables
- 🔌 **Extensible Plugin System** - Convention-based plugin discovery and execution
- ✅ **Comprehensive Validation** - Validates terraform installation, workspace names, and configuration before execution
- 🧪 **Dry-Run Mode** - Preview what would be executed without running terraform commands

## Installation

```bash
npm install -g terraflow
```

Or use the `tf` alias:

```bash
npm install -g terraflow
# Then use 'tf' instead of 'terraflow'
```

## Requirements

- **Node.js** >= 18.x
- **Terraform** installed and available in PATH

## Quick Start

### Option 1: Scaffold a New Project (Recommended)

The fastest way to get started is to scaffold a new infrastructure project:

```bash
# Create a new AWS project with JavaScript
terraflow init my-infrastructure --provider aws --language javascript

# Or create an Azure project with TypeScript
terraflow init my-infrastructure --provider azure --language typescript

# Or create a GCP project with Python
terraflow init my-infrastructure --provider gcp --language python
```

This creates a complete project structure with:
- Terraform configuration files for your cloud provider
- Application code templates in your chosen language
- Pre-configured `.tfwconfig.yml` with backend settings
- Example `.env.example` file
- Complete `.gitignore` and `README.md`

See [Project Scaffolding Documentation](docs/scaffolding.md) for complete details.

### Option 2: Add Terraflow to Existing Project

1. **Initialize configuration:**

```bash
terraflow config init
```

This creates a `.tfwconfig.yml` file with examples for all backends, secrets providers, and auth configurations.

2. **Configure your backend and secrets** in `.tfwconfig.yml`:

```yaml
backend:
  type: s3
  config:
    bucket: ${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state
    key: ${GITHUB_REPOSITORY}
    region: ${AWS_REGION}

secrets:
  provider: aws-secrets
  config:
    secret_name: myapp/terraform-vars
    region: ${AWS_REGION}
```

3. **Run terraform commands:**

```bash
# Plan changes
terraflow plan

# Apply changes
terraflow apply

# Destroy infrastructure
terraflow destroy
```

## Basic Usage

### Workspace Derivation

Terraflow automatically derives workspace names from git context:

```bash
# On branch 'feature/new-api' → workspace: 'feature-new-api'
terraflow plan

# On tag 'v1.0.0' → workspace: 'v1-0-0'
git checkout v1.0.0
terraflow plan

# Explicitly set workspace
terraflow --workspace production plan
```

### Configuration Hierarchy

Configuration is merged in this order (later overrides earlier):

1. Default values
2. Config file (`.tfwconfig.yml`)
3. Environment variables (`TERRAFLOW_*`)
4. CLI arguments (highest priority)

### Template Variables

Use template variables in your configuration:

```yaml
backend:
  type: s3
  config:
    bucket: ${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state
    key: ${GITHUB_REPOSITORY}/terraform.tfstate
```

Available variables:
- All environment variables
- `AWS_ACCOUNT_ID`, `AWS_REGION`
- `AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`
- `GCP_PROJECT_ID`
- `GITHUB_REPOSITORY`, `GIT_BRANCH`, `GIT_TAG`, `GIT_COMMIT_SHA`
- `HOSTNAME`, `WORKSPACE`

### Dry-Run Mode

Preview what would be executed:

```bash
terraflow --dry-run plan
```

### Show Configuration

View resolved configuration with source tracking:

```bash
terraflow config show
```

This shows the final configuration after all merging, with sources (CLI, ENV, FILE, DEFAULT) and masked sensitive values.

## Examples

### AWS with S3 Backend and Secrets Manager

```yaml
# .tfwconfig.yml
backend:
  type: s3
  config:
    bucket: ${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state
    key: ${GITHUB_REPOSITORY}
    region: ${AWS_REGION}
    dynamodb_table: terraform-statelock

secrets:
  provider: aws-secrets
  config:
    secret_name: myapp/terraform-vars
    region: ${AWS_REGION}

auth:
  assume_role:
    role_arn: arn:aws:iam::123456789012:role/TerraformRole
```

### Azure with AzureRM Backend

```yaml
# .tfwconfig.yml
backend:
  type: azurerm
  config:
    storage_account_name: myterraformstate
    container_name: tfstate
    key: terraform.tfstate
    resource_group_name: terraform-rg

auth:
  service_principal:
    client_id: ${AZURE_CLIENT_ID}
    tenant_id: ${AZURE_TENANT_ID}
    client_secret: ${AZURE_CLIENT_SECRET}
```

### GCP with GCS Backend

```yaml
# .tfwconfig.yml
backend:
  type: gcs
  config:
    bucket: ${GCP_PROJECT_ID}-terraform-state
    prefix: terraform/state

secrets:
  provider: gcp-secret-manager
  config:
    secret_name: terraform-vars
    project_id: ${GCP_PROJECT_ID}
```

## Documentation

- **[Project Scaffolding Guide](./docs/scaffolding.md)** - Complete guide to `terraflow init` command
- **[Configuration Reference](./docs/configuration.md)** - Complete configuration options and examples
- **[Plugin Development Guide](./docs/plugins.md)** - How to develop and test plugins
- **[Releasing Guide](./docs/releasing.md)** - Complete release process and versioning
- **[CI/CD Setup](./docs/ci-cd.md)** - GitHub Actions workflows and secrets
- **[Examples](./docs/examples/)** - Example configurations and scaffolded projects

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Build
npm run build
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Code of Conduct

This project adheres to a Code of Conduct. Please see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for details.

## License

MIT - see [LICENSE](./LICENSE) file for details

## See Also

- [SPECIFICATION.md](./SPECIFICATION.md) - Complete development specification
- [Terraform Documentation](https://www.terraform.io/docs)
