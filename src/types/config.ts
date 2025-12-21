/**
 * Configuration type definitions for Terraflow CLI
 */

/**
 * Backend configuration
 */
export interface BackendConfig {
  /** Backend type: local | s3 | azurerm | gcs */
  type: string;
  /** Backend-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Secrets provider configuration
 */
export interface SecretsConfig {
  /** Secrets provider type: env | aws-secrets | azure-keyvault | gcp-secret-manager */
  provider: string;
  /** Provider-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** AWS assume role configuration */
  assume_role?: {
    role_arn: string;
    session_name?: string;
    duration?: number;
  };
  /** Azure service principal configuration */
  service_principal?: {
    client_id: string;
    tenant_id: string;
    client_secret?: string;
  };
  /** GCP service account configuration */
  service_account?: {
    key_file: string;
  };
}

/**
 * Workspace derivation strategy
 */
export type WorkspaceStrategy = 'cli' | 'env' | 'tag' | 'branch' | 'hostname';

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log level: error | warn | info | debug */
  level: 'error' | 'warn' | 'info' | 'debug';
  /** Enable Terraform log output */
  terraform_log?: boolean;
  /** Terraform log level */
  terraform_log_level?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Require git commit before apply/destroy */
  require_git_commit?: boolean;
  /** List of allowed workspace names (empty = allow all) */
  allowed_workspaces?: string[];
}

/**
 * Main Terraflow configuration file structure
 */
export interface TerraflowConfig {
  /** Workspace name */
  workspace?: string;
  /** Terraform working directory */
  'working-dir'?: string;
  /** Skip git commit check */
  'skip-commit-check'?: boolean;
  /** Backend configuration */
  backend?: BackendConfig;
  /** Secrets management configuration */
  secrets?: SecretsConfig;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Terraform variables */
  variables?: Record<string, unknown>;
  /** Workspace derivation strategy */
  workspace_strategy?: WorkspaceStrategy[];
  /** Validation configuration */
  validations?: ValidationConfig;
  /** Logging configuration */
  logging?: LoggingConfig;
}
