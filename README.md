# Terraflow CLI

An opinionated Node.js CLI wrapper for Terraform that provides intelligent workspace management, multi-cloud backend support, secrets integration, and git-aware workflows.

## Overview

Terraflow enhances Terraform workflows by providing:
- Intelligent workspace derivation from git context
- Multi-cloud backend support (AWS S3, Azure RM, GCP GCS)
- Secrets management integration
- Git-aware validation and workflows
- Convention-based plugin system

## Installation

```bash
npm install -g terraflow
```

## Quick Start

```bash
# Initialize configuration
terraflow config init

# Run terraform plan
terraflow plan

# Run terraform apply
terraflow apply
```

## Requirements

- Node.js >= 18.x
- Terraform installed and available in PATH

## Project Status

This project is in active development. The foundation is set up with:
- ✅ TypeScript configuration with strict mode
- ✅ ESLint and Prettier configuration
- ✅ Jest testing framework
- ✅ Project structure and placeholder modules
- ✅ Plugin system interfaces

See [SPECIFICATION.md](./SPECIFICATION.md) for complete details.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Build
npm run build
```

## License

MIT

