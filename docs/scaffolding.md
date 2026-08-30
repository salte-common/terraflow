# Project Scaffolding

Terraflow provides a powerful project scaffolding feature that generates complete infrastructure projects with opinionated defaults and best practices.

## Overview

The `terraflow new` command scaffolds a new infrastructure project with:
- **Cursor-ready** — Optimized for [Cursor](https://cursor.com/) to get up and running quickly with AI-assisted development
- Pre-configured Terraform files for your cloud provider
- Application code templates in your chosen language
- Complete configuration files (`.tfwconfig.yml`, `.env.example`, `.gitignore`, `.editorconfig`, `README.md`)
- `.vscode/settings.json` for format-on-save and lint integration (requires editor extensions — see [IDE setup](#ide-setup-cursor--vs-code))
- Git repository with pre-commit secret scanning and an initial commit
- `.ai-metadata.json` initialized with stats for all scaffolded files (100% AI-authored)
- Cursor rules for Terraflow usage, `.ai-metadata.json` maintenance, validation after changes, and development standards (language, platform, salte-common/standards)
- Proper directory structure following best practices

## Command Syntax

```bash
terraflow new [project-name] [options]
```

### Options

- `-p, --provider <name>`: Cloud provider (`aws`, `azure`, or `gcp`). Default: `aws`
- `-l, --language <name>`: Application language (`javascript`, `typescript`, `python`, or `go`). Default: `javascript`
- `-d, --working-dir <path>`: Directory where to create the project. Default: current directory
- `-f, --force`: Overwrite existing files if present. Default: `false`

### Examples

```bash
# Create AWS project with JavaScript in current directory
terraflow new

# Create named project with default options (AWS + JavaScript)
terraflow new my-infrastructure

# Create Azure project with TypeScript
terraflow new my-infrastructure --provider azure --language typescript

# Create GCP project with Python
terraflow new my-infrastructure --provider gcp --language python

# Create project in specific directory
terraflow new my-infrastructure --working-dir ~/projects

# Overwrite existing files
terraflow new my-infrastructure --force
```

## Generated Project Structure

```
<project-name>/
├── .ai-metadata.json         # AI code tracking (initialized with scaffold stats)
├── .cursor/
│   └── rules/
│       ├── terraform.mdc             # Cursor instructions for Terraflow usage
│       ├── ai-metadata.mdc           # Cursor instructions for .ai-metadata.json maintenance
│       └── development-standards.mdc # Cursor instructions (language, platform, validation, salte-common/standards)
├── .githooks/
│   └── pre-commit                    # Secret-scanning pre-commit hook
├── .vscode/
│   └── settings.json                 # Format-on-save and lint integration (requires extensions)
├── scripts/
│   └── setup-githooks.sh             # Re-enable git hooks if needed
├── src/
│   ├── main/
│   │   └── index.js (or .ts, .py, .go based on --language)
│   └── test/
│       └── index.spec.js (or appropriate test file)
├── terraform/
│   ├── modules/
│   │   ├── inputs.tf
│   │   ├── main.tf
│   │   └── outputs.tf
│   ├── _init.tf          # Provider and backend configuration
│   ├── inputs.tf         # Provider-specific variables
│   ├── locals.tf         # Common tags/labels
│   ├── main.tf           # Main infrastructure resources
│   └── outputs.tf        # Output values
├── .tfwconfig.yml        # Terraflow configuration
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules (.vscode/settings.json is committed)
├── .editorconfig         # EditorConfig for consistent formatting
└── README.md             # Project documentation (includes IDE extension prerequisites)
```

## Cloud Provider Examples

### AWS Project

```bash
terraflow new my-aws-project --provider aws --language javascript
```

**Generated Terraform Configuration:**
- AWS provider ~> 5.0
- S3 backend configuration
- Variables: `aws_region`, `environment`
- Pre-configured `.tfwconfig.yml` with `provider: aws` and S3 backend settings

**Files Generated:**
- `terraform/_init.tf` with AWS provider and S3 backend
- `terraform/inputs.tf` with AWS-specific variables
- `.tfwconfig.yml` with `provider: aws` and `type: s3` backend

### Azure Project

```bash
terraflow new my-azure-project --provider azure --language typescript
```

**Generated Terraform Configuration:**
- AzureRM provider ~> 3.0
- AzureRM backend configuration
- Variables: `azure_location`, `environment`
- Pre-configured `.tfwconfig.yml` with `provider: azure` and AzureRM backend settings

**Files Generated:**
- `terraform/_init.tf` with AzureRM provider and backend
- `terraform/inputs.tf` with Azure-specific variables
- `.tfwconfig.yml` with `provider: azure` and `type: azurerm` backend
- `tsconfig.json` for TypeScript projects

### GCP Project

```bash
terraflow new my-gcp-project --provider gcp --language python
```

**Generated Terraform Configuration:**
- Google provider ~> 5.0
- GCS backend configuration
- Variables: `gcp_project_id`, `gcp_region`, `environment`
- Pre-configured `.tfwconfig.yml` with `provider: gcp` and GCS backend settings

**Files Generated:**
- `terraform/_init.tf` with Google provider and GCS backend
- `terraform/inputs.tf` with GCP-specific variables
- `.tfwconfig.yml` with `provider: gcp` and `type: gcs` backend
- `requirements.txt` with pytest for Python projects

## Language-Specific Features

### JavaScript

```bash
terraflow new my-project --language javascript
```

**Generated Files:**
- `src/main/index.js` - Main application entry point
- `src/test/index.spec.js` - Jest test file
- `.gitignore` includes Node.js patterns

### TypeScript

```bash
terraflow new my-project --language typescript
```

**Generated Files:**
- `src/main/index.ts` - TypeScript main file with type annotations
- `src/test/index.spec.ts` - TypeScript test file
- `tsconfig.json` - TypeScript configuration
- `.gitignore` includes Node.js patterns

### Python

```bash
terraflow new my-project --language python
```

**Generated Files:**
- `src/main/index.py` - Python main file
- `src/test/test_main.py` - pytest test file
- `requirements.txt` - Python dependencies (includes pytest)
- `.gitignore` includes Python patterns

### Go

```bash
terraflow new my-project --language go
```

**Generated Files:**
- `src/main/index.go` - Go main file
- `src/test/main_test.go` - Go test file
- `go.mod` - Go module definition
- `.gitignore` includes Go patterns

## IDE setup (Cursor / VS Code)

Scaffolded projects include `.vscode/settings.json` configured for format-on-save, lint-on-save, and Terraform formatting. **These settings only take full effect when the matching editor extensions are installed.** Without them, you will not get inline squiggles, automatic formatting, or syntax diagnostics in the editor.

Install extensions in [Cursor](https://cursor.com/) or [VS Code](https://code.visualstudio.com/) before developing. The generated `README.md` lists the exact extensions for your `--language` choice.

### Recommended extensions by language

| Language | Extensions (Marketplace ID) | Purpose |
|----------|------------------------------|---------|
| **JavaScript** | `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `hashicorp.terraform` | ESLint squiggles, Prettier format-on-save, Terraform |
| **TypeScript** | `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `hashicorp.terraform` | ESLint squiggles, Prettier format-on-save, Terraform |
| **Python** | `ms-python.python`, `ms-python.pylint`, `ms-python.black-formatter`, `hashicorp.terraform` | Syntax checking, Pylint squiggles, Black format-on-save, Terraform |
| **Go** | `golang.go`, `hashicorp.terraform` | gofmt, golangci-lint on save, syntax checking, Terraform |

**All languages** include Terraform extension support because every scaffolded project has a `terraform/` directory.

### What you get with extensions installed

- **Red/yellow squiggles** for lint and syntax errors in `src/` and `terraform/`
- **Format on save** for application code and `.tf` files
- **ESLint fix-on-save** (JavaScript/TypeScript) via `source.fixAll.eslint`

### Cursor rules vs editor extensions

Cursor rules in `.cursor/rules/` instruct the AI agent to run `npm run lint`, `pytest`, `terraflow fmt`, etc. after changes. **Editor extensions provide real-time visual feedback while you type** — both are complementary.

If diagnostics do not appear after installing extensions, reload the editor window and ensure project dependencies are installed (`npm install`, `pip install -r requirements.txt`, etc.).

## Project Name Validation

Project names must:
- Contain only alphanumeric characters, hyphens, and underscores
- Not be empty

**Valid Examples:**
- `my-project`
- `my_project`
- `project123`
- `my-project-123_test`

**Invalid Examples:**
- `my project` (spaces)
- `my.project` (dots)
- `my/project` (slashes)
- `my@project` (special characters)

## Working Directory

By default, the project is created in the current directory. You can specify a different location:

```bash
# Create in current directory
terraflow new my-project

# Create in specific directory
terraflow new my-project --working-dir ~/projects

# Create in current directory without project name
terraflow new
```

## Force Flag

If the target directory is not empty, Terraflow will refuse to create the project unless you use the `--force` flag:

```bash
# This will fail if directory exists and is not empty
terraflow new my-project

# This will overwrite existing files
terraflow new my-project --force
```

**Warning:** Using `--force` will overwrite existing files. Use with caution!

## Next Steps After Scaffolding

After running `terraflow new`, follow these steps:

1. **Navigate to project directory** (if you created a named project):
   ```bash
   cd my-project
   ```

2. **Install IDE extensions** (see [IDE setup](#ide-setup-cursor--vs-code) and your project `README.md`):
   - Required for inline linting, formatting, and syntax checking
   - `.vscode/settings.json` is already configured; extensions activate it

3. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` with your credentials:**
   - AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - Azure: `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`
   - GCP: `GOOGLE_APPLICATION_CREDENTIALS`, `GCP_PROJECT_ID`

5. **Review and update `.tfwconfig.yml`:**
   - The `provider` field is automatically set based on the `--provider` flag used with `terraflow new`
   - Configure your backend bucket/storage account
   - Set up secrets provider if needed
   - Adjust workspace strategy if needed

6. **Initialize Terraform:**
   ```bash
   terraflow init
   ```

7. **Plan your infrastructure:**
   ```bash
   terraflow plan
   ```

8. **Apply your infrastructure:**
   ```bash
   terraflow apply
   ```

9. **Optional: Create `SPECIFICATION.md`** — Add a project specification document in the root to define requirements, architecture, and conventions. Cursor will read this file to inform code suggestions.

## Template Customization

Terraflow templates are located in `src/templates/` and can be customized for your organization's needs. See [Contributing Guide](../CONTRIBUTING.md#adding-new-templates) for details on template customization.

## Troubleshooting

### Error: "Invalid project name"

**Problem:** Project name contains invalid characters.

**Solution:** Use only alphanumeric characters, hyphens, and underscores.

```bash
# ❌ Invalid
terraflow new "my project"

# ✅ Valid
terraflow new my-project
```

### Error: "Directory is not empty"

**Problem:** Target directory already contains files.

**Solution:** Use `--force` flag or choose a different directory.

```bash
# Option 1: Use --force
terraflow new my-project --force

# Option 2: Use different directory
terraflow new my-project --working-dir ~/other-location
```

### Error: "Invalid provider"

**Problem:** Provider name is misspelled or not supported.

**Solution:** Use one of: `aws`, `azure`, or `gcp`.

```bash
# ❌ Invalid
terraflow new my-project --provider amazon

# ✅ Valid
terraflow new my-project --provider aws
```

### Error: "Invalid language"

**Problem:** Language name is misspelled or not supported.

**Solution:** Use one of: `javascript`, `typescript`, `python`, or `go`.

```bash
# ❌ Invalid
terraflow new my-project --language js

# ✅ Valid
terraflow new my-project --language javascript
```

### Template files not found

**Problem:** Templates directory is missing or corrupted.

**Solution:** Reinstall Terraflow or rebuild from source:

```bash
npm install -g terraflow
# or
npm run build
```

## Examples

See the [examples directory](examples/) for complete scaffolded project examples:
- [AWS + JavaScript Example](examples/aws-javascript/)
- [Azure + TypeScript Example](examples/azure-typescript/)
- [GCP + Python Example](examples/gcp-python/)

## Related Documentation

- [Configuration Guide](configuration.md) - Complete configuration reference
- [Getting Started](../README.md#quick-start) - Quick start guide
- [Contributing Guide](../CONTRIBUTING.md) - How to add new templates

