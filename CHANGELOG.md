# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-21

### Added

#### Core Features
- **CLI Framework**: Complete CLI implementation with Commander.js
- **Configuration Management**: Hierarchical configuration system with `.tfwconfig.yml` support
  - Configuration hierarchy: CLI > Env > Config File > Defaults
  - Template variable resolution (`${VAR}` syntax)
  - Environment variable support (`TERRAFLOW_*`)
- **Workspace Derivation**: Intelligent workspace name derivation from git context
  - Priority: CLI → env → tag → branch → hostname
  - Ephemeral branch detection (e.g., `feature/`, `fix/`)
  - Workspace name sanitization
- **Execution Context**: Runtime context builder with cloud and VCS information
- **Validation Engine**: Comprehensive validation system
  - Terraform installation check
  - Git repository validation
  - Workspace name validation
  - Git working directory clean check
  - Command-specific validations (full, backend-required, minimal)
- **Environment Setup**: Automatic environment variable setup
  - `.env` file loading
  - Cloud provider auto-detection (AWS, Azure, GCP)
  - VCS environment variables (GitHub Actions, GitLab CI compatible)
  - Terraform variable conversion (`TF_VAR_*`)
  - Template variable resolution
- **Terraform Executor**: Complete terraform command execution
  - Plugin orchestration (auth → secrets → backend)
  - Workspace management (select/create)
  - Dry-run mode support
  - Proper error handling and exit codes

#### Backend Plugins
- **Local Backend** (`local`): Default local state storage
- **S3 Backend** (`s3`): AWS S3 backend with DynamoDB state locking
  - Support for encryption, KMS keys
  - Backend migration detection
- **AzureRM Backend** (`azurerm`): Azure Resource Manager backend
- **GCS Backend** (`gcs`): Google Cloud Storage backend

#### Secrets Plugins
- **Environment Secrets** (`env`): Uses existing environment variables
- **AWS Secrets Manager** (`aws-secrets`): Fetches secrets from AWS Secrets Manager
- **Azure Key Vault** (`azure-keyvault`): Fetches secrets from Azure Key Vault
- **GCP Secret Manager** (`gcp-secret-manager`): Fetches secrets from GCP Secret Manager

#### Authentication Plugins
- **AWS Assume Role** (`aws-assume-role`): Assumes AWS IAM roles via STS
- **Azure Service Principal** (`azure-service-principal`): Azure service principal authentication
- **GCP Service Account** (`gcp-service-account`): GCP service account key file authentication

#### Commands
- **Config Commands**:
  - `terraflow config show`: Display resolved configuration with source tracking
  - `terraflow config init`: Generate skeleton configuration file
- **Terraform Command Passthrough**: All terraform commands supported via passthrough

#### Utilities
- **Git Utils**: Git repository operations
  - Branch/tag detection
  - Commit SHA retrieval
  - Remote URL parsing
  - Working directory clean check
- **Cloud Utils**: Cloud provider detection and information
  - AWS account ID and region detection
  - Azure subscription and tenant ID detection
  - GCP project ID detection
- **Template Utils**: Template variable resolution
  - `${VAR}` syntax support
  - Recursive object resolution
- **Logger**: Structured logging with levels (error, warn, info, debug)

#### Documentation
- **README.md**: Comprehensive project documentation with examples
- **Configuration Reference** (`docs/configuration.md`): Complete configuration documentation
- **Plugin Development Guide** (`docs/plugins.md`): Plugin development guide
- **CI/CD Documentation** (`docs/ci-cd.md`): GitHub Actions workflows and setup
- **Example Configurations** (`docs/examples/`): Example configs for AWS, Azure, GCP, GitHub Actions, GitLab CI
- **CONTRIBUTING.md**: Contribution guidelines
- **CODE_OF_CONDUCT.md**: Contributor Covenant Code of Conduct

#### CI/CD
- **GitHub Actions Workflows**:
  - CI workflow with Node.js 18.x and 20.x test matrix
  - Coverage upload to Codecov
  - Build artifact upload
  - Publish workflow for NPM releases with provenance
  - Release workflow for GitHub releases with changelog generation

#### Testing
- **Unit Tests**: Comprehensive unit test coverage (>80%)
- **Integration Tests**: End-to-end integration tests
- **Test Coverage**: 82%+ code coverage

### Technical Details

- **Runtime**: Node.js >= 18.x
- **Language**: TypeScript with strict mode
- **Package Manager**: npm
- **Linting**: ESLint + Prettier (salte-common/standards)
- **Testing**: Jest with ts-jest
- **Type Safety**: Full TypeScript type definitions exported

### Breaking Changes

None. This is the initial release.

### Security

- Sensitive values are masked in configuration output
- No secrets logged to console
- Secure defaults (encryption enabled, state locking enabled)
- NPM package published with provenance for supply chain security

[1.0.0]: https://github.com/yourusername/terraflow/releases/tag/v1.0.0

