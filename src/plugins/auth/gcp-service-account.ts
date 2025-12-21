/**
 * GCP service account auth plugin
 * Authenticates using GCP service account key file and returns GCP credentials environment variables
 */

import { readFileSync, existsSync } from 'fs';
import type { AuthPlugin, AuthConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';

/**
 * GCP service account authentication plugin
 */
export const gcpServiceAccount: AuthPlugin = {
  name: 'gcp-service-account',

  /**
   * Validate GCP service account configuration
   * @param config - Auth configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: AuthConfig): Promise<void> => {
    if (!config.service_account) {
      throw new ConfigError('GCP service account configuration is required');
    }

    const saConfig = config.service_account;

    // key_file is required
    if (!saConfig.key_file) {
      throw new ConfigError('GCP service account requires "key_file" configuration');
    }

    // Check if key file exists
    if (!existsSync(saConfig.key_file)) {
      throw new ConfigError(`GCP service account key file does not exist: ${saConfig.key_file}`);
    }

    // Try to read and parse the key file to validate it's valid JSON
    try {
      const keyFileContent = readFileSync(saConfig.key_file, 'utf8');
      const keyData = JSON.parse(keyFileContent);

      // Validate it's a service account key file
      if (!keyData.type || keyData.type !== 'service_account') {
        throw new ConfigError(
          `Invalid GCP service account key file: ${saConfig.key_file}. Expected type "service_account".`
        );
      }

      if (!keyData.project_id) {
        Logger.warn(
          `GCP service account key file "${saConfig.key_file}" does not contain project_id. Project ID will need to be set via GCLOUD_PROJECT environment variable.`
        );
      }
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new ConfigError(
          `GCP service account key file "${saConfig.key_file}" is not valid JSON: ${error.message}`
        );
      }

      throw new ConfigError(
        `Failed to read GCP service account key file "${saConfig.key_file}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  /**
   * Authenticate using GCP service account key file
   * Returns GCP credentials environment variables
   * @param config - Auth configuration
   * @param context - Execution context
   * @returns Environment variables for GCP authentication
   */
  authenticate: async (
    config: AuthConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>> => {
    if (!config.service_account) {
      throw new ConfigError('GCP service account configuration is required');
    }

    const saConfig = config.service_account;
    const keyFilePath = saConfig.key_file;

    try {
      // Read and parse key file
      const keyFileContent = readFileSync(keyFilePath, 'utf8');
      const keyData = JSON.parse(keyFileContent);

      // Build environment variables for GCP authentication
      const envVars: Record<string, string> = {
        GOOGLE_APPLICATION_CREDENTIALS: keyFilePath,
      };

      // Add project ID from key file, context, or leave undefined (GCP SDK will use default)
      const projectId =
        keyData.project_id ||
        context.cloud.gcpProjectId ||
        process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT;

      if (projectId) {
        envVars.GCLOUD_PROJECT = projectId;
        envVars.GCP_PROJECT = projectId;
        envVars.GOOGLE_CLOUD_PROJECT = projectId;
      }

      Logger.info(`✅ Successfully configured GCP service account from: ${keyFilePath}`);

      return envVars;
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new ConfigError(
          `GCP service account key file "${keyFilePath}" is not valid JSON: ${error.message}`
        );
      }

      if (error instanceof Error) {
        throw new ConfigError(
          `Failed to read GCP service account key file "${keyFilePath}": ${error.message}`
        );
      }

      throw new ConfigError(
        `Failed to read GCP service account key file "${keyFilePath}": ${String(error)}`
      );
    }
  },
};
