/**
 * GCS backend plugin
 * Handles Google Cloud Storage Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';
import { TemplateUtils } from '../../utils/templates';

/**
 * GCS backend configuration interface
 */
interface GCSBackendConfig {
  bucket: string;
  prefix?: string;
  credentials?: string;
  impersonate_service_account?: string;
  access_token?: string;
  encryption_key?: string;
}

/**
 * GCS backend plugin
 */
export const gcsBackend: BackendPlugin = {
  name: 'gcs',

  /**
   * Validate GCS backend configuration
   * @param config - Backend configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: BackendConfig): Promise<void> => {
    if (!config.config) {
      throw new ConfigError('GCS backend requires configuration');
    }

    const gcsConfig = config.config as unknown as GCSBackendConfig;

    // Required fields
    if (!gcsConfig.bucket) {
      throw new ConfigError('GCS backend requires "bucket" configuration');
    }
  },

  /**
   * Generate Terraform backend configuration arguments
   * @param config - Backend configuration
   * @param context - Execution context (for template variable resolution)
   * @returns Array of -backend-config arguments for terraform init
   */
  getBackendConfig: async (config: BackendConfig, context: ExecutionContext): Promise<string[]> => {
    if (!config.config) {
      throw new ConfigError('GCS backend requires configuration');
    }

    // Build template context from execution context
    const templateVars: Record<string, string> = {
      ...context.templateVars,
    };

    // Add cloud-specific variables
    if (context.cloud.gcpProjectId) {
      templateVars.GCP_PROJECT_ID = context.cloud.gcpProjectId;
    }

    // Resolve template variables in config
    const resolvedConfig = TemplateUtils.resolveObject(config.config, templateVars) as Record<
      string,
      unknown
    >;

    const gcsConfig = resolvedConfig as unknown as GCSBackendConfig;

    // Build backend-config arguments
    const backendArgs: string[] = [];

    // Required fields
    backendArgs.push(`-backend-config=bucket=${gcsConfig.bucket}`);

    // Optional fields with defaults
    const prefix = gcsConfig.prefix || 'terraform/state';
    backendArgs.push(`-backend-config=prefix=${prefix}`);

    if (gcsConfig.credentials) {
      backendArgs.push(`-backend-config=credentials=${gcsConfig.credentials}`);
    }
    if (gcsConfig.impersonate_service_account) {
      backendArgs.push(
        `-backend-config=impersonate_service_account=${gcsConfig.impersonate_service_account}`
      );
    }
    if (gcsConfig.access_token) {
      backendArgs.push(`-backend-config=access_token=${gcsConfig.access_token}`);
    }
    if (gcsConfig.encryption_key) {
      backendArgs.push(`-backend-config=encryption_key=${gcsConfig.encryption_key}`);
    }

    Logger.debug(`Generated ${backendArgs.length} backend-config arguments for GCS backend`);

    return backendArgs;
  },
};
