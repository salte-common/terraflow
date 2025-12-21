# Terraflow CLI - Development Specification

## Project Overview

**Name:** terraflow (with `tf` alias)
**Description:** An opinionated Node.js CLI wrapper for Terraform that provides intelligent workspace management, multi-cloud backend support, secrets integration, and git-aware workflows.
**Language:** Node.js (TypeScript preferred)
**License:** MIT
**Repository Standards:** Follow https://github.com/salte-common/standards recursively

## Core Principles

1. **Convention over Configuration** - Sensible defaults, minimal required config
2. **Simplicity over Complexity** - Clean, predictable behavior
3. **Multi-cloud Support** - AWS, Azure, GCP from day one
4. **Extensible Plugin System** - Convention-based plugin discovery
5. **Git-Aware** - Intelligent workspace derivation from git context

## Technical Stack

- **Runtime:** Node.js >= 18.x
- **Language:** TypeScript
- **CLI Framework:** Commander.js or Yargs
- **Configuration:** yaml (js-yaml)
- **Environment:** dotenv
- **Testing:** Jest
- **Linting:** ESLint + Prettier (per salte-common/standards)
- **Package Manager:** npm

## Project Structure
```
terraflow/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── publish.yml
│       └── release.yml
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── commands/                # Command handlers
│   │   ├── base.ts
│   │   ├── plan.ts
│   │   ├── apply.ts
│   │   ├── destroy.ts
│   │   └── config.ts
│   ├── core/
│   │   ├── config.ts            # Configuration manager
│   │   ├── context.ts           # Execution context
│   │   ├── validator.ts         # Validation engine
│   │   ├── environment.ts       # Environment setup
│   │   └── terraform.ts         # Terraform executor
│   ├── plugins/
│   │   ├── backends/
│   │   │   ├── local.ts
│   │   │   ├── s3.ts
│   │   │   ├── azurerm.ts
│   │   │   └── gcs.ts
│   │   ├── secrets/
│   │   │   ├── env.ts
│   │   │   ├── aws-secrets.ts
│   │   │   ├── azure-keyvault.ts
│   │   │   └── gcp-secret-manager.ts
│   │   └── auth/
│   │       ├── aws-assume-role.ts
│   │       ├── azure-service-principal.ts
│   │       └── gcp-service-account.ts
│   ├── utils/
│   │   ├── git.ts               # Git operations
│   │   ├── cloud.ts             # Cloud provider detection
│   │   ├── templates.ts         # Variable templating
│   │   └── logger.ts            # Logging utilities
│   └── types/
│       ├── config.ts            # Configuration types
│       ├── context.ts           # Context types
│       └── plugins.ts           # Plugin interfaces
├── bin/
│   ├── terraflow.js             # Main executable
│   └── tf.js                    # Alias executable
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   ├── README.md
│   ├── configuration.md
│   ├── plugins.md
│   └── examples/
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── package.json
├── jest.config.js
└── README.md
```

## CLI Interface

### Command Structure
```bash
terraflow <terraform-command> [terraflow-options] [terraform-args]
tf <terraform-command> [terraflow-options] [terraform-args]
```

### Global Options
```
--config, -c <path>          Path to config file (default: <working-dir>/.tfwconfig.yml)
--workspace, -w <name>       Override workspace name
--backend, -b <type>         Backend type: local|s3|azurerm|gcs (default: local)
--secrets, -s <type>         Secrets provider: env|aws-secrets|azure-keyvault|gcp-secret-manager
--skip-commit-check          Skip git commit validation
--working-dir, -d <path>     Terraform working directory (default: ./terraform)
--assume-role <arn>          AWS role ARN to assume (AWS only)
--verbose, -v                Verbose logging
--debug                      Debug logging (includes terraform debug output)
--dry-run                    Show what would be executed without running
--no-color                   Disable colored output
-h, --help                   Show help
-V, --version                Show version
```

### Environment Variables

All CLI options have environment variable equivalents:
```
TERRAFLOW_CONFIG
TERRAFLOW_WORKSPACE
TERRAFLOW_BACKEND
TERRAFLOW_SECRETS
TERRAFLOW_SKIP_COMMIT_CHECK
TERRAFLOW_WORKING_DIR
TERRAFLOW_ASSUME_ROLE
```

Boolean handling: `true|1|yes` enables, anything else disables

### Special Commands
```bash
terraflow config show              # Show resolved configuration
terraflow config init [-o file]    # Generate skeleton config file
```

## Configuration Schema

### .tfwconfig.yml Structure
```yaml
# Global settings
workspace: development
working-dir: ./terraform
skip-commit-check: false

# Backend configuration
backend:
  type: local  # local | s3 | azurerm | gcs
  config:
    # S3-specific
    bucket: ${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state
    key: ${GITHUB_REPOSITORY}
    region: ${AWS_REGION}
    dynamodb_table: terraform-statelock
    kms_key_id: arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:alias/terraform-state
    encrypt: true
    
    # Azure-specific
    # storage_account_name: mystorageaccount
    # container_name: tfstate
    # key: terraform.tfstate
    
    # GCP-specific
    # bucket: my-gcs-bucket
    # prefix: terraform/state

# Secrets management
secrets:
  provider: env  # env | aws-secrets | azure-keyvault | gcp-secret-manager
  config:
    # AWS Secrets Manager
    region: us-east-1
    secret_name: myapp/terraform-vars
    
    # Azure Key Vault
    # vault_name: my-keyvault
    
    # GCP Secret Manager
    # project_id: my-project

# Authentication
auth:
  # AWS assume role
  assume_role:
    role_arn: arn:aws:iam::123456789:role/TerraformRole
    session_name: terraflow-session
    duration: 3600
  
  # Azure service principal
  # service_principal:
  #   client_id: xxx
  #   tenant_id: xxx
  
  # GCP service account
  # service_account:
  #   key_file: /path/to/key.json

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
  allowed_workspaces: []  # Empty = allow all

# Logging
logging:
  level: info  # error | warn | info | debug
  terraform_log: false
  terraform_log_level: TRACE
```

### Configuration Hierarchy

1. CLI parameters (highest priority)
2. Environment variables
3. Config file
4. Computed defaults
5. Hard-coded defaults (lowest priority)

### Template Variable Support

Basic `${VAR}` substitution supported in config values.

**Available template variables:**
- All environment variables
- `AWS_ACCOUNT_ID` - from `aws sts get-caller-identity`
- `AWS_REGION` - from env or AWS config
- `AZURE_SUBSCRIPTION_ID` - from `az account show`
- `GCP_PROJECT_ID` - from `gcloud config get-value project`
- `GITHUB_REPOSITORY` - from git remote
- `GITLAB_PROJECT_PATH` - from git remote
- `GIT_BRANCH` - current branch
- `GIT_TAG` - current tag
- `GIT_COMMIT_SHA` - full SHA
- `GIT_SHORT_SHA` - short SHA
- `HOSTNAME` - machine hostname
- `WORKSPACE` - resolved workspace name

## Plugin System

### Plugin Interface Contracts

#### Backend Plugin
```typescript
interface BackendPlugin {
  name: string;
  
  validate(config: BackendConfig): Promise<void>;
  
  getBackendConfig(
    config: BackendConfig,
    context: ExecutionContext
  ): Promise<string[]>;
  
  setup?(config: BackendConfig, context: ExecutionContext): Promise<void>;
}
```

#### Secrets Plugin
```typescript
interface SecretsPlugin {
  name: string;
  
  validate(config: SecretsConfig): Promise<void>;
  
  // Returns secrets as TF_VAR_* environment variables
  getSecrets(
    config: SecretsConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>>;
}
```

**Convention:** All keys in retrieved secrets are automatically prefixed with `TF_VAR_`

#### Auth Plugin
```typescript
interface AuthPlugin {
  name: string;
  
  validate(config: AuthConfig): Promise<void>;
  
  // Returns temporary credentials as environment variables
  authenticate(
    config: AuthConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>>;
}
```

### Plugin Discovery

Convention-based loading from `src/plugins/{type}/{name}.ts`

Example:
- Backend type `s3` → loads `src/plugins/backends/s3.ts`
- Secrets provider `aws-secrets` → loads `src/plugins/secrets/aws-secrets.ts`

No registration required - if file exists and exports correct interface, it works.

### Plugin Execution Order

**Hardcoded, not configurable:**

1. **Auth Plugin** (if configured) - provides credentials
2. **Secrets Plugin** (if configured) - provides TF_VAR_* variables
3. **Backend Plugin** (always) - provides backend config
4. **Terraform Execution**

## Workspace Derivation

### Resolution Strategy (default)

1. CLI parameter (`--workspace`)
2. Environment variable (`TERRAFLOW_WORKSPACE`)
3. Git tag (if on a tag)
4. Git branch (if not ephemeral)
5. Hostname

### Ephemeral Branch Detection

**Any branch with a prefix** (text followed by `/`) is considered ephemeral:
- `feature/new-vpc` → use hostname
- `bugfix/auth-issue` → use hostname
- `release/v1.2.0` → use hostname
- `dave/experiment` → use hostname
- `main` → use "main"

**Regex:** `/^[^/]+\//`

### Workspace Name Sanitization

- Remove `refs/heads/` or `refs/tags/` prefix
- Replace invalid characters (`/`, spaces) with hyphens
- Result must match `/^[a-zA-Z0-9_-]+$/`

## Validation Rules

### Always Validated

1. **Terraform installed** - `terraform version` must succeed
2. **Workspace name valid** - matches `/^[a-zA-Z0-9_-]+$/`
3. **Git repo check** - determine if git is available (not fatal if missing)

### Command-Specific Validations

#### Full Validation Commands
`apply`, `destroy`, `import`, `refresh`

**Validations:**
- Git working directory clean (unless `--skip-commit-check`)
- Workspace in allowed list (if configured)
- Required variables set (if configured)
- Backend config valid
- Cloud credentials available
- Plugin configs valid

#### Backend-Required Commands
`plan`, `state`, `workspace`, `output`, `show`

**Validations:**
- Backend config valid (if not local)
- Cloud credentials available (if remote backend)

#### Minimal Validation Commands
`fmt`, `validate`, `version`, `providers`

**Validations:**
- Terraform installed only

### Validation Failures

All validation failures are **fatal** - execution stops immediately.

Exception: In `--dry-run` mode, validations run but don't stop execution (to show all issues).

## Environment Setup

### Execution Flow
```javascript
1. Load .env file (bootstrap credentials)
2. Setup cloud environment (detect account IDs, regions)
3. Setup VCS environment (git branch, commit, repository)
4. Resolve template variables in config
5. Execute auth plugin (if configured)
6. Execute secrets plugin (if configured)
7. Setup Terraform variables from config
8. Setup logging configuration
9. Execute backend plugin
10. Run terraform command
```

### Environment Variable Categories

#### From .env File
- General environment variables
- Bootstrap credentials (AWS_ACCESS_KEY_ID, etc.)
- NOT automatically converted to TF_VAR_*

#### From Config File `variables:` Section
- Explicitly converted to TF_VAR_*
- Safe, controlled conversion

#### From Secrets Plugin
- ALL keys automatically prefixed with TF_VAR_*
- Convention-based mapping

#### Passthrough
- Existing TF_VAR_* environment variables pass through unchanged

### Cloud Provider Auto-Detection

#### AWS
- Sync `AWS_REGION` and `AWS_DEFAULT_REGION`
- Default to `us-east-1` if not set
- Fetch account ID via `aws sts get-caller-identity`

#### Azure
- Fetch subscription ID via `az account show`
- Fetch tenant ID

#### GCP
- Fetch project ID via `gcloud config get-value project`

### VCS Environment Setup

- Parse git remote for GitHub/GitLab repository names
- Set `GITHUB_REPOSITORY`, `GITLAB_PROJECT_PATH` for template compatibility
- Set `GIT_BRANCH`, `GIT_TAG`, `GIT_COMMIT_SHA`, `GIT_SHORT_SHA`
- Simulate GitHub Actions variables (`GITHUB_REF`, `GITHUB_SHA`)
- Simulate GitLab CI variables (`CI_COMMIT_REF_NAME`, `CI_COMMIT_SHORT_SHA`)

## Terraform Integration

### Initialization
```bash
terraform init \
  -backend-config=bucket=... \
  -backend-config=key=... \
  -backend-config=...
```

### Workspace Management
```bash
terraform workspace select <name> || terraform workspace new <name>
```

### Command Execution

Pass through all terraform arguments after terraflow options:
```bash
terraflow apply --workspace dev -auto-approve -var="count=3"
                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                 Passed to terraform
```

### State Migration

Detect backend changes and warn user:
```
⚠️  Backend changed from 'local' to 's3'. Terraform will prompt to migrate state.
```

Support `--migrate-state` flag to auto-approve.

## Logging and Output

### Log Levels

- `error` - Errors only
- `warn` - Warnings and errors
- `info` - Standard output (default)
- `debug` - Verbose output

### Output Format
```
🔧 Setting up environment...
✅ Environment setup complete

🔐 Authenticating via AWS assume role...
✅ Authentication successful

🔑 Fetching secrets from aws-secrets...
✅ Loaded 3 Terraform variables from secrets

📦 Configuring s3 backend...
✅ Backend configuration prepared

🚀 Executing: terraform apply
```

### Dry Run Output
```
🔍 DRY RUN MODE - Terraform command will not be executed

✅ All validations passed

═══════════════════════════════════════════════════════════
Would execute:
═══════════════════════════════════════════════════════════
Workspace:        development
Working dir:      ./terraform
Backend:          s3
Terraform:        1.10.2

Backend init args:
  -backend-config=bucket=us-east-1-123456-terraform-state
  -backend-config=key=myorg/myrepo
  -backend-config=region=us-east-1
  -backend-config=encrypt=true
  -backend-config=dynamodb_table=terraform-statelock

Command: terraform apply -auto-approve
═══════════════════════════════════════════════════════════
```

## Testing Requirements

### Unit Tests

- Configuration parsing and merging
- Template variable resolution
- Workspace derivation logic
- Validation rules
- Plugin interface contracts

### Integration Tests

- End-to-end command execution (with mocked terraform)
- Plugin loading and execution
- Environment setup
- Git integration

### Test Coverage

Minimum 80% code coverage required

## Documentation Requirements

### README.md

- Quick start guide
- Installation instructions
- Basic usage examples
- Link to full documentation

### docs/configuration.md

- Complete configuration reference
- All available options
- Template variable reference
- Examples for each cloud provider

### docs/plugins.md

- Plugin development guide
- Plugin interface specifications
- Example plugin implementations

### docs/examples/

- Example configurations for common scenarios
- AWS + GitHub Actions
- Azure + GitLab CI
- GCP + local development
- Multi-environment setups

## NPM Package Configuration

### package.json
```json
{
  "name": "terraflow",
  "version": "1.0.0",
  "description": "Opinionated Terraform workflow CLI with multi-cloud support",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "terraflow": "./bin/terraflow.js",
    "tf": "./bin/tf.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "terraform",
    "infrastructure",
    "iac",
    "devops",
    "cli",
    "aws",
    "azure",
    "gcp"
  ],
  "author": "Dave Sibiski",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/terraflow.git"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "js-yaml": "^4.1.0",
    "dotenv": "^16.0.0",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/js-yaml": "^4.0.5",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

## GitHub Actions Workflows

### CI Workflow (.github/workflows/ci.yml)
```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: matrix.node-version == '20.x'
        with:
          files: ./coverage/lcov.info
  
  build:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

### Publish Workflow (.github/workflows/publish.yml)
```yaml
name: Publish to NPM

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Publish to NPM
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Release Workflow (.github/workflows/release.yml)
```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Generate changelog
        id: changelog
        uses: mikepenz/release-changelog-builder-action@v4
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body: ${{ steps.changelog.outputs.changelog }}
          files: |
            dist/**/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Salte-Common Standards Compliance

Follow all standards from https://github.com/salte-common/standards:

### Repository Standards

- ✅ README.md with project description, installation, usage
- ✅ LICENSE file (MIT)
- ✅ CONTRIBUTING.md with contribution guidelines
- ✅ CODE_OF_CONDUCT.md
- ✅ .gitignore for Node.js projects
- ✅ Semantic versioning
- ✅ Conventional commits

### Code Standards

- ✅ TypeScript with strict mode
- ✅ ESLint configuration
- ✅ Prettier formatting
- ✅ Comprehensive JSDoc comments
- ✅ Unit tests with >80% coverage
- ✅ Integration tests

### CI/CD Standards

- ✅ Automated testing on PR
- ✅ Automated publishing to NPM
- ✅ GitHub releases with changelogs
- ✅ Branch protection rules

### Documentation Standards

- ✅ API documentation
- ✅ Configuration examples
- ✅ Plugin development guide
- ✅ Troubleshooting guide

## Implementation Priority

### Phase 1: MVP (v1.0.0)

1. Core CLI framework with command parsing
2. Configuration loading and merging
3. Workspace derivation logic
4. Git integration
5. Local backend support
6. Basic validation (terraform installed, workspace valid)
7. Terraform command passthrough
8. Environment variable handling

### Phase 2: Cloud Backends (v1.1.0)

1. S3 backend plugin
2. Azure backend plugin
3. GCP backend plugin
4. Backend migration support
5. Cloud credential detection

### Phase 3: Secrets & Auth (v1.2.0)

1. AWS assume role auth plugin
2. AWS Secrets Manager plugin
3. Environment secrets plugin (.env)
4. Template variable resolution

### Phase 4: Advanced Features (v1.3.0)

1. Azure Key Vault secrets plugin
2. GCP Secret Manager plugin
3. Advanced validations (allowed workspaces, required vars)
4. Dry-run mode improvements
5. Enhanced logging and output

### Phase 5: Polish & Docs (v1.4.0)

1. Comprehensive documentation
2. Example configurations
3. Plugin development guide
4. Video tutorials
5. Performance optimizations

## Success Criteria

- ✅ Passes all unit and integration tests
- ✅ >80% code coverage
- ✅ Follows salte-common/standards
- ✅ Successfully publishes to NPM
- ✅ Works on Linux, macOS, Windows
- ✅ Supports Node 18.x and 20.x
- ✅ Clear, comprehensive documentation
- ✅ Zero critical security vulnerabilities
- ✅ Backward compatible configuration format

## Additional Notes for Cursor

### Code Organization

- Use TypeScript interfaces for all plugin contracts
- Export types from `src/types/` for external use
- Keep plugin implementations simple and focused
- Use dependency injection where appropriate
- Prefer composition over inheritance

### Error Handling

- Use custom error classes (ValidationError, ConfigError, etc.)
- Provide helpful error messages with suggestions
- Exit with appropriate exit codes
- Log errors to stderr, output to stdout

### Security Considerations

- Never log secrets or sensitive values
- Sanitize all user input
- Validate all external command output
- Use secure defaults (encryption on, locking on)
- Warn on insecure configurations

### Performance

- Lazy-load plugins (only load what's needed)
- Cache expensive operations (git commands, AWS API calls)
- Minimize external command execution
- Parallelize independent operations where safe

### Backward Compatibility

- Configuration format must remain backward compatible
- Deprecate features gracefully with warnings
- Support migration paths for breaking changes
- Document all breaking changes in changelog

---

This specification should be comprehensive enough for Cursor to implement the entire Terraflow CLI. Let me know if you need any clarifications or additions!