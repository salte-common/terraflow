# Project Scaffolding

Terraflow provides a powerful project scaffolding feature that generates complete infrastructure projects with opinionated defaults and best practices.

## Overview

The `terraflow init` command scaffolds a new infrastructure project with:
- Pre-configured Terraform files for your cloud provider
- Application code templates in your chosen language
- Complete configuration files (`.tfwconfig.yml`, `.env.example`, `.gitignore`, `README.md`)
- Proper directory structure following best practices

## Command Syntax

```bash
terraflow init [project-name] [options]
```

### Options

- `-p, --provider <name>`: Cloud provider (`aws`, `azure`, or `gcp`). Default: `aws`
- `-l, --language <name>`: Application language (`javascript`, `typescript`, `python`, or `go`). Default: `javascript`
- `-d, --working-dir <path>`: Directory where to create the project. Default: current directory
- `-f, --force`: Overwrite existing files if present. Default: `false`

### Examples

```bash
# Create AWS project with JavaScript in current directory
terraflow init

# Create named project with default options (AWS + JavaScript)
terraflow init my-infrastructure

# Create Azure project with TypeScript
terraflow init my-infrastructure --provider azure --language typescript

# Create GCP project with Python
terraflow init my-infrastructure --provider gcp --language python

# Create project in specific directory
terraflow init my-infrastructure --working-dir ~/projects

# Overwrite existing files
terraflow init my-infrastructure --force
```

## Generated Project Structure

```
<project-name>/
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
├── .gitignore            # Git ignore rules
└── README.md             # Project documentation
```

## Cloud Provider Examples

### AWS Project

```bash
terraflow init my-aws-project --provider aws --language javascript
```

**Generated Terraform Configuration:**
- AWS provider ~> 5.0
- S3 backend configuration
- Variables: `aws_region`, `environment`
- Pre-configured `.tfwconfig.yml` with S3 backend settings

**Files Generated:**
- `terraform/_init.tf` with AWS provider and S3 backend
- `terraform/inputs.tf` with AWS-specific variables
- `.tfwconfig.yml` with `type: s3` backend

### Azure Project

```bash
terraflow init my-azure-project --provider azure --language typescript
```

**Generated Terraform Configuration:**
- AzureRM provider ~> 3.0
- AzureRM backend configuration
- Variables: `azure_location`, `environment`
- Pre-configured `.tfwconfig.yml` with AzureRM backend settings

**Files Generated:**
- `terraform/_init.tf` with AzureRM provider and backend
- `terraform/inputs.tf` with Azure-specific variables
- `.tfwconfig.yml` with `type: azurerm` backend
- `tsconfig.json` for TypeScript projects

### GCP Project

```bash
terraflow init my-gcp-project --provider gcp --language python
```

**Generated Terraform Configuration:**
- Google provider ~> 5.0
- GCS backend configuration
- Variables: `gcp_project_id`, `gcp_region`, `environment`
- Pre-configured `.tfwconfig.yml` with GCS backend settings

**Files Generated:**
- `terraform/_init.tf` with Google provider and GCS backend
- `terraform/inputs.tf` with GCP-specific variables
- `.tfwconfig.yml` with `type: gcs` backend
- `requirements.txt` with pytest for Python projects

## Language-Specific Features

### JavaScript

```bash
terraflow init my-project --language javascript
```

**Generated Files:**
- `src/main/index.js` - Main application entry point
- `src/test/index.spec.js` - Jest test file
- `.gitignore` includes Node.js patterns

### TypeScript

```bash
terraflow init my-project --language typescript
```

**Generated Files:**
- `src/main/index.ts` - TypeScript main file with type annotations
- `src/test/index.spec.ts` - TypeScript test file
- `tsconfig.json` - TypeScript configuration
- `.gitignore` includes Node.js patterns

### Python

```bash
terraflow init my-project --language python
```

**Generated Files:**
- `src/main/index.py` - Python main file
- `src/test/test_main.py` - pytest test file
- `requirements.txt` - Python dependencies (includes pytest)
- `.gitignore` includes Python patterns

### Go

```bash
terraflow init my-project --language go
```

**Generated Files:**
- `src/main/index.go` - Go main file
- `src/test/main_test.go` - Go test file
- `go.mod` - Go module definition
- `.gitignore` includes Go patterns

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
terraflow init my-project

# Create in specific directory
terraflow init my-project --working-dir ~/projects

# Create in current directory without project name
terraflow init
```

## Force Flag

If the target directory is not empty, Terraflow will refuse to create the project unless you use the `--force` flag:

```bash
# This will fail if directory exists and is not empty
terraflow init my-project

# This will overwrite existing files
terraflow init my-project --force
```

**Warning:** Using `--force` will overwrite existing files. Use with caution!

## Next Steps After Scaffolding

After running `terraflow init`, follow these steps:

1. **Navigate to project directory** (if you created a named project):
   ```bash
   cd my-project
   ```

2. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your credentials:**
   - AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - Azure: `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`
   - GCP: `GOOGLE_APPLICATION_CREDENTIALS`, `GCP_PROJECT_ID`

4. **Review and update `.tfwconfig.yml`:**
   - Configure your backend bucket/storage account
   - Set up secrets provider if needed
   - Adjust workspace strategy if needed

5. **Initialize Terraform:**
   ```bash
   terraflow init
   ```

6. **Plan your infrastructure:**
   ```bash
   terraflow plan
   ```

7. **Apply your infrastructure:**
   ```bash
   terraflow apply
   ```

## Template Customization

Terraflow templates are located in `src/templates/` and can be customized for your organization's needs. See [Contributing Guide](../CONTRIBUTING.md#adding-new-templates) for details on template customization.

## Troubleshooting

### Error: "Invalid project name"

**Problem:** Project name contains invalid characters.

**Solution:** Use only alphanumeric characters, hyphens, and underscores.

```bash
# ❌ Invalid
terraflow init "my project"

# ✅ Valid
terraflow init my-project
```

### Error: "Directory is not empty"

**Problem:** Target directory already contains files.

**Solution:** Use `--force` flag or choose a different directory.

```bash
# Option 1: Use --force
terraflow init my-project --force

# Option 2: Use different directory
terraflow init my-project --working-dir ~/other-location
```

### Error: "Invalid provider"

**Problem:** Provider name is misspelled or not supported.

**Solution:** Use one of: `aws`, `azure`, or `gcp`.

```bash
# ❌ Invalid
terraflow init my-project --provider amazon

# ✅ Valid
terraflow init my-project --provider aws
```

### Error: "Invalid language"

**Problem:** Language name is misspelled or not supported.

**Solution:** Use one of: `javascript`, `typescript`, `python`, or `go`.

```bash
# ❌ Invalid
terraflow init my-project --language js

# ✅ Valid
terraflow init my-project --language javascript
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

