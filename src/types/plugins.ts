/**
 * Plugin system interfaces for Terraflow CLI
 */

import type { ExecutionContext } from './context';
import type { BackendConfig, SecretsConfig, AuthConfig } from './config';

/**
 * Backend plugin interface
 * Handles Terraform backend configuration
 */
export interface BackendPlugin {
  /** Plugin name (must match the plugin file name) */
  name: string;

  /**
   * Validate backend configuration
   * @param config - Backend configuration to validate
   * @throws {Error} If configuration is invalid
   */
  validate(config: BackendConfig): Promise<void>;

  /**
   * Generate Terraform backend configuration arguments
   * @param config - Backend configuration
   * @param context - Execution context
   * @returns Array of backend-config arguments for terraform init
   */
  getBackendConfig(config: BackendConfig, context: ExecutionContext): Promise<string[]>;

  /**
   * Optional setup hook for backend initialization
   * Called before terraform init
   * @param config - Backend configuration
   * @param context - Execution context
   */
  setup?(config: BackendConfig, context: ExecutionContext): Promise<void>;
}

/**
 * Secrets plugin interface
 * Retrieves secrets and converts them to TF_VAR_* environment variables
 */
export interface SecretsPlugin {
  /** Plugin name (must match the plugin file name) */
  name: string;

  /**
   * Validate secrets configuration
   * @param config - Secrets configuration to validate
   * @throws {Error} If configuration is invalid
   */
  validate(config: SecretsConfig): Promise<void>;

  /**
   * Retrieve secrets and return as TF_VAR_* environment variables
   * All keys are automatically prefixed with TF_VAR_
   * @param config - Secrets configuration
   * @param context - Execution context
   * @returns Record of environment variable key-value pairs (already prefixed with TF_VAR_)
   */
  getSecrets(config: SecretsConfig, context: ExecutionContext): Promise<Record<string, string>>;
}

/**
 * Auth plugin interface
 * Handles authentication and returns temporary credentials as environment variables
 */
export interface AuthPlugin {
  /** Plugin name (must match the plugin file name) */
  name: string;

  /**
   * Validate auth configuration
   * @param config - Auth configuration to validate
   * @throws {Error} If configuration is invalid
   */
  validate(config: AuthConfig): Promise<void>;

  /**
   * Authenticate and return credentials as environment variables
   * @param config - Auth configuration
   * @param context - Execution context
   * @returns Record of environment variable key-value pairs for credentials
   */
  authenticate(config: AuthConfig, context: ExecutionContext): Promise<Record<string, string>>;
}
