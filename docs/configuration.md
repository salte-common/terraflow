# Configuration Reference

This document provides a complete reference for all Terraflow configuration options.

> **Tip:** You can generate a pre-configured `.tfwconfig.yml` file using `terraflow init`. See the [Project Scaffolding Guide](scaffolding.md) for details.

## Configuration File

Terraflow uses a `.tfwconfig.yml` file in your working directory (or specified via `--config` or `TERRAFLOW_CONFIG` environment variable).

You can create this file manually or generate it using `terraflow init` which creates a complete project structure with a pre-configured `.tfwconfig.yml` file tailored to your cloud provider.

## Configuration Hierarchy

Configuration values are merged in the following order (later sources override earlier ones):

1. **Default values** (hard-coded defaults)
2. **Config file** (`.tfwconfig.yml`)
3. **Environment variables** (`TERRAFLOW_*`)
4. **CLI arguments** (highest priority)

## Global Settings

### `workspace`

Default workspace name. If not specified, Terraflow derives it from git context (branch, tag, or hostname).

```yaml
workspace: production
```

**Environment Variable:** `TERRAFLOW_WORKSPACE`

**CLI Option:** `--workspace`, `-w`

### `working-dir`

Terraform working directory. Defaults to `./terraform`.

```yaml
working-dir: ./infrastructure
```

**Environment Variable:** `TERRAFLOW_WORKING_DIR`

**CLI Option:** `--working-dir`, `-d`

### `skip-commit-check`

Skip git working directory clean check. Defaults to `false`.

```yaml
skip-commit-check: false
```

**Environment Variable:** `TERRAFLOW_SKIP_COMMIT_CHECK`

**CLI Option:** `--skip-commit-check`

**Boolean handling:** `true|1|yes` enables, anything else disables

## Backend Configuration

Backend configuration determines where Terraform state is stored.

### Backend Types

- `local` - Local state file (default)
- `s3` - AWS S3 backend
- `azurerm` - Azure Resource Manager backend
- `gcs` - Google Cloud Storage backend

### Local Backend

No configuration required. State is stored locally in `.terraform/terraform.tfstate`.

```yaml
backend:
  type: local
```

### S3 Backend

**Required fields:**
- `bucket` - S3 bucket name
- `key` - State file key/path

**Optional fields:**
- `region` - AWS region (defaults to `AWS_REGION` env var)
- `encrypt` - Enable encryption (default: `true`)
- `dynamodb_table` - DynamoDB table for state locking (default: `terraform-statelock`)
- `kms_key_id` - KMS key ARN for encryption
- `profile` - AWS profile name
- `role_arn` - IAM role ARN to assume
- `access_key` - AWS access key ID
- `secret_key` - AWS secret access key

```yaml
backend:
  type: s3
  config:
    bucket: ${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state
    key: ${GITHUB_REPOSITORY}/terraform.tfstate
    region: ${AWS_REGION}
    encrypt: true
    dynamodb_table: terraform-statelock
    kms_key_id: arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:alias/terraform-state
```

### AzureRM Backend

**Required fields:**
- `storage_account_name` - Azure storage account name
- `container_name` - Storage container name
- `key` - State file key/path

**Optional fields:**
- `resource_group_name` - Resource group name
- `subscription_id` - Azure subscription ID
- `tenant_id` - Azure tenant ID
- `client_id` - Service principal client ID
- `client_secret` - Service principal client secret
- `access_key` - Storage account access key
- `sas_token` - Shared access signature token

```yaml
backend:
  type: azurerm
  config:
    storage_account_name: myterraformstate
    container_name: tfstate
    key: terraform.tfstate
    resource_group_name: terraform-rg
    subscription_id: ${AZURE_SUBSCRIPTION_ID}
    tenant_id: ${AZURE_TENANT_ID}
```

### GCS Backend

**Required fields:**
- `bucket` - GCS bucket name

**Optional fields:**
- `prefix` - State file prefix (default: `terraform/state`)
- `credentials` - Path to service account key file
- `project` - GCP project ID

```yaml
backend:
  type: gcs
  config:
    bucket: ${GCP_PROJECT_ID}-terraform-state
    prefix: terraform/state
    project: ${GCP_PROJECT_ID}
```

## Secrets Configuration

Secrets configuration determines how Terraform variables are sourced from secret management systems.

### Secrets Providers

- `env` - Environment variables (default, no-op)
- `aws-secrets` - AWS Secrets Manager
- `azure-keyvault` - Azure Key Vault
- `gcp-secret-manager` - GCP Secret Manager

### Environment Secrets Provider

Uses existing environment variables. No configuration needed.

```yaml
secrets:
  provider: env
```

**Note:** You manage `TF_VAR_*` prefixes yourself in `.env` file. No automatic conversion is performed.

### AWS Secrets Manager

**Required fields:**
- `secret_name` - Secret name or ARN

**Optional fields:**
- `region` - AWS region (defaults to `AWS_REGION` env var)

```yaml
secrets:
  provider: aws-secrets
  config:
    secret_name: myapp/terraform-vars
    region: ${AWS_REGION}
```

**Secret Format:** The secret should be a JSON object. All keys are automatically prefixed with `TF_VAR_`:

```json
{
  "db_password": "secret123",
  "api_key": "key456"
}
```

Becomes: `TF_VAR_db_password=secret123`, `TF_VAR_api_key=key456`

### Azure Key Vault

**Required fields:**
- `vault_name` - Key Vault name

**Optional fields:**
- `secret_name` - Specific secret name (if omitted, fetches all secrets)

```yaml
secrets:
  provider: azure-keyvault
  config:
    vault_name: my-keyvault
    secret_name: terraform-vars  # Optional
```

**Secret Format:** 
- If secret contains JSON object, keys are extracted and prefixed with `TF_VAR_`
- If secret is plain text, it becomes `TF_VAR_{secret_name}`

### GCP Secret Manager

**Required fields:**
- `secret_name` - Secret name

**Optional fields:**
- `project_id` - GCP project ID (defaults to `GCLOUD_PROJECT` env var)

```yaml
secrets:
  provider: gcp-secret-manager
  config:
    secret_name: terraform-vars
    project_id: ${GCP_PROJECT_ID}
```

**Secret Format:** Same as AWS Secrets Manager - JSON object keys are prefixed with `TF_VAR_`.

## Authentication Configuration

Authentication configuration sets up cloud provider credentials before Terraform execution.

### AWS Assume Role

Assumes an AWS IAM role and returns temporary credentials.

**Required fields:**
- `role_arn` - IAM role ARN

**Optional fields:**
- `session_name` - Session name (default: `terraflow-session`)
- `duration` - Session duration in seconds (default: `3600`, min: `900`, max: `43200`)

```yaml
auth:
  assume_role:
    role_arn: arn:aws:iam::123456789012:role/TerraformRole
    session_name: terraflow-session
    duration: 3600
```

**Sets environment variables:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

### Azure Service Principal

Authenticates using Azure service principal credentials.

**Required fields:**
- `client_id` - Service principal client ID
- `tenant_id` - Azure tenant ID

**Optional fields:**
- `client_secret` - Service principal client secret (if not provided, uses managed identity or certificate)

```yaml
auth:
  service_principal:
    client_id: ${AZURE_CLIENT_ID}
    tenant_id: ${AZURE_TENANT_ID}
    client_secret: ${AZURE_CLIENT_SECRET}
```

**Sets environment variables:**
- `ARM_CLIENT_ID`
- `ARM_TENANT_ID`
- `ARM_CLIENT_SECRET` (if provided)
- `ARM_SUBSCRIPTION_ID` (from context or env)

### GCP Service Account

Authenticates using GCP service account key file.

**Required fields:**
- `key_file` - Path to service account key JSON file

```yaml
auth:
  service_account:
    key_file: /path/to/service-account-key.json
```

**Sets environment variables:**
- `GOOGLE_APPLICATION_CREDENTIALS` (path to key file)
- `GCLOUD_PROJECT`, `GCP_PROJECT`, `GOOGLE_CLOUD_PROJECT` (project ID from key file, context, or env)

## Terraform Variables

Define Terraform variables directly in the config file. These are automatically converted to `TF_VAR_*` environment variables.

```yaml
variables:
  environment: production
  instance_count: 3
  region: us-east-1
```

Becomes:
- `TF_VAR_environment=production`
- `TF_VAR_instance_count=3`
- `TF_VAR_region=us-east-1`

## Workspace Strategy

Define the priority order for workspace derivation.

```yaml
workspace_strategy:
  - cli
  - env
  - tag
  - branch
  - hostname
```

**Default order:**
1. CLI argument (`--workspace`)
2. Environment variable (`TERRAFLOW_WORKSPACE`)
3. Git tag (if on a tag)
4. Git branch (if in a git repository)
5. Hostname (fallback)

**Ephemeral branch detection:** Branches matching `/^[^/]+\//` (e.g., `feature/`, `fix/`) fall back to hostname.

## Validation Configuration

Configure validation rules.

```yaml
validations:
  require_git_commit: true
  allowed_workspaces:
    - production
    - staging
    - development
```

### `require_git_commit`

Require git working directory to be clean before destructive operations (`apply`, `destroy`). Defaults to `true`.

**CLI Option:** `--skip-commit-check` overrides this.

### `allowed_workspaces`

List of allowed workspace names. Empty list means all workspaces are allowed.

## Logging Configuration

Configure logging behavior.

```yaml
logging:
  level: info  # error | warn | info | debug
  terraform_log: false
  terraform_log_level: TRACE
```

### `level`

Terraflow log level. Controls verbosity of Terraflow's own logging.

- `error` - Errors only
- `warn` - Warnings and errors
- `info` - Informational messages (default)
- `debug` - Detailed debug output

**Environment Variable:** `TERRAFLOW_LOG_LEVEL`

**CLI Options:** `--verbose` (sets to `info`), `--debug` (sets to `debug`)

### `terraform_log`

Enable Terraform's own logging. Defaults to `false`.

### `terraform_log_level`

Terraform log level when `terraform_log` is enabled. Options: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`.

**Sets environment variable:** `TF_LOG` and `TF_LOG_PATH`

## Template Variables

Configuration values support template variable substitution using `${VAR}` syntax.

### Available Variables

#### Environment Variables

All environment variables are available:

```yaml
bucket: ${MY_BUCKET_NAME}
```

#### Cloud Provider Variables

**AWS:**
- `AWS_ACCOUNT_ID` - Detected via `aws sts get-caller-identity`
- `AWS_REGION` - From `AWS_REGION` or `AWS_DEFAULT_REGION` env var

**Azure:**
- `AZURE_SUBSCRIPTION_ID` - Detected via `az account show`
- `AZURE_TENANT_ID` - Detected via `az account show`

**GCP:**
- `GCP_PROJECT_ID` - Detected via `gcloud config get-value project`

#### VCS Variables

- `GITHUB_REPOSITORY` - Repository in format `owner/repo` (from git remote)
- `GITLAB_PROJECT_PATH` - Project path (from git remote)
- `GIT_BRANCH` - Current git branch
- `GIT_TAG` - Current git tag (if on a tag)
- `GIT_COMMIT_SHA` - Full commit SHA
- `GIT_SHORT_SHA` - Short commit SHA (7 characters)

#### System Variables

- `HOSTNAME` - Machine hostname
- `WORKSPACE` - Resolved workspace name

### Template Resolution

Templates are resolved recursively throughout the configuration:

```yaml
backend:
  type: s3
  config:
    bucket: ${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state
    key: ${GITHUB_REPOSITORY}/terraform.tfstate
    region: ${AWS_REGION}
```

If a variable is not found, the template string is left as-is.

## Complete Example

```yaml
# Global settings
workspace: development
working-dir: ./terraform
skip-commit-check: false

# Backend configuration
backend:
  type: s3
  config:
    bucket: ${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state
    key: ${GITHUB_REPOSITORY}/terraform.tfstate
    region: ${AWS_REGION}
    encrypt: true
    dynamodb_table: terraform-statelock

# Secrets management
secrets:
  provider: aws-secrets
  config:
    secret_name: myapp/terraform-vars
    region: ${AWS_REGION}

# Authentication
auth:
  assume_role:
    role_arn: arn:aws:iam::${AWS_ACCOUNT_ID}:role/TerraformRole
    session_name: terraflow-session
    duration: 3600

# Terraform variables
variables:
  environment: production
  instance_count: 3

# Workspace derivation strategy
workspace_strategy:
  - cli
  - env
  - tag
  - branch
  - hostname

# Validations
validations:
  require_git_commit: true
  allowed_workspaces: []

# Logging
logging:
  level: info
  terraform_log: false
  terraform_log_level: TRACE
```

## Environment Variables

All configuration options can be set via environment variables with `TERRAFLOW_` prefix:

- `TERRAFLOW_CONFIG` - Path to config file
- `TERRAFLOW_WORKSPACE` - Workspace name
- `TERRAFLOW_BACKEND` - Backend type
- `TERRAFLOW_SECRETS` - Secrets provider
- `TERRAFLOW_WORKING_DIR` - Working directory
- `TERRAFLOW_SKIP_COMMIT_CHECK` - Skip commit check (boolean)
- `TERRAFLOW_LOG_LEVEL` - Log level

## CLI Options

All configuration can be overridden via CLI options:

```bash
terraflow --workspace production --working-dir ./infra --backend s3 plan
```

See `terraflow --help` for complete list of options.

