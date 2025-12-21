/**
 * Config command handler
 * Manages Terraflow configuration
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import yaml from 'js-yaml';
import type { TerraflowConfig } from '../types/config';
import { ConfigManager, type CliOptions } from '../core/config';
import { Logger } from '../utils/logger';

/**
 * Fields that should always be masked
 * These are exact field names that contain sensitive data
 */
const ALWAYS_MASKED_FIELDS = [
  'client_secret',
  'secret_access_key',
  'session_token',
  'access_key_id',
  'access_key',
  'api_key',
  'password',
  'secret',
  'key', // Only mask if it's clearly a credential key, not a generic key field
  'token',
];

/**
 * Sensitive field patterns that should be masked
 */
const SENSITIVE_PATTERNS = [
  /password$/i,
  /secret$/i,
  /.*_secret$/i,
  /.*_key$/i, // But not role_arn, kms_key_id, etc.
  /token$/i,
  /credential$/i,
  /access.*key$/i,
  /session.*token$/i,
  /client.*secret$/i,
];

/**
 * Fields that should NOT be masked (even if they match patterns)
 */
const EXCLUDED_FIELDS = ['role_arn', 'kms_key_id', 'key', 'key_file', 'key_id'];

/**
 * Check if a field name indicates sensitive data
 */
function isSensitiveField(fieldName: string): boolean {
  // Check if field is explicitly excluded
  if (EXCLUDED_FIELDS.includes(fieldName)) {
    return false;
  }

  const lowerName = fieldName.toLowerCase();
  // Check exact matches first (these are always sensitive)
  if (ALWAYS_MASKED_FIELDS.includes(lowerName)) {
    return true;
  }

  // For 'key', only mask if it's clearly a credential (not key_file, key_id, etc.)
  if (lowerName === 'key') {
    // Don't mask generic 'key' fields - too many false positives
    return false;
  }

  // Check patterns (e.g., client_secret, access_key, session_token)
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Mask sensitive values in an object recursively
 */
function maskSensitiveValues(obj: unknown, path = ''): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => maskSensitiveValues(item, `${path}[${index}]`));
  }

  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const fullPath = path ? `${path}.${key}` : key;
        const value = (obj as Record<string, unknown>)[key];

        if (isSensitiveField(key) || isSensitiveField(fullPath)) {
          // Mask the value
          if (typeof value === 'string' && value.length > 0) {
            masked[key] = '***MASKED***';
          } else {
            masked[key] = value;
          }
        } else {
          // Recursively mask nested objects
          masked[key] = maskSensitiveValues(value, fullPath);
        }
      }
    }
    return masked;
  }

  return obj;
}

/**
 * Config command handler class
 */
export class ConfigCommand {
  /**
   * Show resolved configuration
   * Displays merged configuration with source tracking and masked sensitive values
   */
  static async show(cliOptions: CliOptions = {}): Promise<void> {
    try {
      // Load configuration
      const config = await ConfigManager.load(cliOptions);

      // Mask sensitive values
      const maskedConfig = maskSensitiveValues(config) as TerraflowConfig;

      // Format as YAML
      const yamlOutput = yaml.dump(maskedConfig, {
        indent: 2,
        lineWidth: 120,
        quotingType: '"',
        forceQuotes: false,
      });

      Logger.info('Resolved configuration:');
      Logger.info('');
      Logger.info(yamlOutput);

      // Show configuration sources
      Logger.info('');
      Logger.info('Configuration sources:');
      Logger.info('  CLI: Command-line arguments (highest priority)');
      Logger.info('  ENV: Environment variables');
      Logger.info('  FILE: Configuration file (.tfwconfig.yml)');
      Logger.info('  DEFAULT: Hard-coded defaults (lowest priority)');
      Logger.info('');
      Logger.info('Note: Sensitive values are masked with ***MASKED***');
    } catch (error) {
      Logger.error(
        `Failed to show configuration: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate skeleton configuration file
   * Creates a .tfwconfig.yml with commented examples
   */
  static async init(outputPath?: string, workingDir: string = process.cwd()): Promise<void> {
    try {
      const configPath = outputPath || join(workingDir, '.tfwconfig.yml');

      // Check if file already exists
      if (existsSync(configPath)) {
        Logger.warn(`Configuration file already exists at ${configPath}`);
        Logger.warn('Use --output flag to specify a different filename');
        throw new Error('Configuration file already exists');
      }

      // Generate skeleton
      const skeleton = ConfigCommand.generateConfigSkeleton();

      // Ensure directory exists
      const dir = dirname(configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write file
      writeFileSync(configPath, skeleton, 'utf8');
      Logger.success(`✅ Configuration skeleton created at ${configPath}`);
    } catch (error) {
      Logger.error(
        `Failed to create config file: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate skeleton configuration file content
   */
  static generateConfigSkeleton(): string {
    return `# Terraflow Configuration File
# This file defines your Terraflow configuration
# See https://github.com/your-org/terraflow for full documentation

# Global Settings
# ===============

# Workspace name (optional - will be derived if not specified)
# Priority: CLI > ENV > Tag > Branch > Hostname
workspace: development

# Terraform working directory (default: ./terraform)
# This is where your Terraform files (.tf) should be located
working-dir: ./terraform

# Skip git commit check for destructive operations
# Set to true to skip validation that requires a clean git working directory
skip-commit-check: false

# Backend Configuration
# ====================
# Terraform backend for state storage
# Options: local | s3 | azurerm | gcs

backend:
  # Backend type
  type: local

  # Backend-specific configuration
  config:
    # Local backend (no additional config needed)
    # State is stored in terraform.tfstate in the working directory

    # S3 Backend Example:
    # type: s3
    # config:
    #   bucket: my-terraform-state-bucket
    #   key: terraform.tfstate
    #   region: us-east-1
    #   encrypt: true  # Always recommended
    #   dynamodb_table: terraform-statelock  # For state locking
    #   kms_key_id: arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012  # Optional: KMS encryption

    # Azure RM Backend Example:
    # type: azurerm
    # config:
    #   resource_group_name: terraform-state-rg
    #   storage_account_name: terraformstate
    #   container_name: terraform-state
    #   key: terraform.tfstate

    # GCS Backend Example:
    # type: gcs
    # config:
    #   bucket: terraform-state-bucket
    #   prefix: terraform/state
    #   credentials: /path/to/service-account-key.json  # Optional: path to service account key

# Secrets Management
# ==================
# Secrets provider for retrieving Terraform variables
# Options: env | aws-secrets | azure-keyvault | gcp-secret-manager

# secrets:
#   # Secrets provider type
#   provider: env
#
#   # Provider-specific configuration
#   config:
#     # Environment secrets (no additional config needed)
#     # Secrets are loaded from .env file or existing environment variables
#     # Use TF_VAR_* prefix in .env file for Terraform variables
#
#     # AWS Secrets Manager Example:
#     # provider: aws-secrets
#     # config:
#     #   secret_name: myapp/terraform-vars
#     #   region: us-east-1  # Optional: uses AWS_REGION if not specified
#
#     # Azure Key Vault Example:
#     # provider: azure-keyvault
#     # config:
#     #   vault_name: my-keyvault
#     #   secret_name: terraform-vars
#
#     # GCP Secret Manager Example:
#     # provider: gcp-secret-manager
#     # config:
#     #   project_id: my-gcp-project
#     #   secret_id: terraform-vars

# Authentication
# ==============
# Cloud provider authentication configuration
# Used to assume roles or authenticate with cloud providers

# auth:
#   # AWS Assume Role Example:
#   # assume_role:
#   #   role_arn: arn:aws:iam::123456789012:role/terraform-role
#   #   session_name: terraflow-session  # Optional: default is "terraflow-session"
#   #   duration: 3600  # Optional: session duration in seconds (default: 3600)
#
#   # Azure Service Principal Example:
#   # service_principal:
#   #   client_id: your-client-id
#   #   tenant_id: your-tenant-id
#   #   client_secret: your-client-secret  # Optional: can use Azure CLI or managed identity
#
#   # GCP Service Account Example:
#   # service_account:
#   #   key_file: /path/to/service-account-key.json

# Terraform Variables
# ===================
# Variables passed to Terraform as TF_VAR_* environment variables
# These are converted automatically - no TF_VAR_ prefix needed in config

# variables:
#   environment: development
#   region: us-east-1
#   instance_count: 3

# Workspace Derivation Strategy
# =============================
# Order of precedence for workspace name resolution
# Default: [cli, env, tag, branch, hostname]

# workspace_strategy:
#   - cli      # Command-line --workspace flag
#   - env      # TERRAFLOW_WORKSPACE environment variable
#   - tag      # Git tag (if on a tag)
#   - branch   # Git branch (if not ephemeral)
#   - hostname # System hostname (fallback)

# Validation Configuration
# ========================
# Validation rules for Terraform operations

# validations:
#   # Require git commit before apply/destroy
#   require_git_commit: true
#
#   # List of allowed workspace names (empty = allow all)
#   allowed_workspaces:
#     - development
#     - staging
#     - production

# Logging Configuration
# =====================
# Control logging behavior

# logging:
#   # Log level: error | warn | info | debug
#   level: info
#
#   # Enable Terraform log output
#   terraform_log: false
#
#   # Terraform log level: TRACE | DEBUG | INFO | WARN | ERROR
#   terraform_log_level: TRACE

# Template Variables
# ==================
# Configuration values support template variables using \${VAR} syntax
# Available variables:
#   - Environment variables (e.g., \${AWS_REGION})
#   - Cloud provider info (e.g., \${AWS_ACCOUNT_ID}, \${AZURE_SUBSCRIPTION_ID}, \${GCP_PROJECT_ID})
#   - VCS info (e.g., \${GITHUB_REPOSITORY}, \${GIT_BRANCH}, \${GIT_COMMIT_SHA})
# Example:
#   bucket: \${AWS_REGION}-\${AWS_ACCOUNT_ID}-terraform-state
`;
  }
}
