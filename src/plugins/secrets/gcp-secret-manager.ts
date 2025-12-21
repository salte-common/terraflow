/**
 * GCP Secret Manager plugin
 * Retrieves secrets from GCP Secret Manager and converts them to TF_VAR_* environment variables
 *
 * CONVENTION: Every key in the secret automatically becomes TF_VAR_{key}
 */

import { execSync } from 'child_process';
import type { SecretsPlugin, SecretsConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';

/**
 * GCP Secret Manager configuration interface
 */
interface GcpSecretManagerConfig {
  project_id?: string;
  secret_name: string;
}

/**
 * Process secret value and convert to TF_VAR_* format
 */
function processSecretValue(secretName: string, secretValue: string): Record<string, string> {
  // Try to parse as JSON
  let secretData: Record<string, unknown>;
  try {
    const parsed = JSON.parse(secretValue);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      secretData = parsed;
    } else {
      // Not a JSON object, treat the entire secret value as a single key
      secretData = { [secretName]: secretValue };
    }
  } catch {
    // Not valid JSON, treat the entire secret value as a single key
    secretData = { [secretName]: secretValue };
  }

  // Convert all keys to TF_VAR_{key} format
  const tfVars: Record<string, string> = {};
  for (const key in secretData) {
    if (Object.prototype.hasOwnProperty.call(secretData, key)) {
      const value = secretData[key];
      const tfVarKey = `TF_VAR_${key}`;

      // Convert value to string
      if (value === null || value === undefined) {
        tfVars[tfVarKey] = '';
      } else if (typeof value === 'string') {
        tfVars[tfVarKey] = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        tfVars[tfVarKey] = String(value);
      } else {
        // For objects/arrays, convert to JSON string
        tfVars[tfVarKey] = JSON.stringify(value);
      }
    }
  }

  Logger.info(
    `✅ Loaded ${Object.keys(tfVars).length} Terraform variables from GCP Secret Manager`
  );

  return tfVars;
}

/**
 * GCP Secret Manager secrets plugin
 */
export const gcpSecretManager: SecretsPlugin = {
  name: 'gcp-secret-manager',

  /**
   * Validate GCP Secret Manager configuration
   * @param config - Secrets configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: SecretsConfig): Promise<void> => {
    if (!config.config) {
      throw new ConfigError('GCP Secret Manager requires configuration');
    }

    const gcpConfig = config.config as unknown as GcpSecretManagerConfig;

    // secret_name is required
    if (!gcpConfig.secret_name) {
      throw new ConfigError('GCP Secret Manager requires "secret_name" configuration');
    }

    // project_id should be set (from config, context, or GCLOUD_PROJECT env)
    const projectId =
      gcpConfig.project_id ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Warning but not error - GCP SDK can detect project from credentials
      Logger.debug('GCP project_id not specified, will attempt to auto-detect from credentials');
    }
  },

  /**
   * Retrieve secrets from GCP Secret Manager
   * All keys are automatically prefixed with TF_VAR_
   * @param config - Secrets configuration
   * @param context - Execution context
   * @returns Record of environment variable key-value pairs (prefixed with TF_VAR_)
   */
  getSecrets: async (
    config: SecretsConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>> => {
    if (!config.config) {
      throw new ConfigError('GCP Secret Manager requires configuration');
    }

    const gcpConfig = config.config as unknown as GcpSecretManagerConfig;
    const secretName = gcpConfig.secret_name;

    try {
      // Determine project ID: config > context > env
      let projectId =
        gcpConfig.project_id ||
        context.cloud.gcpProjectId ||
        process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT;

      if (!projectId) {
        // Try to get project ID from gcloud config
        try {
          const detectedProjectId = execSync('gcloud config get-value project', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();

          if (detectedProjectId) {
            Logger.debug(`Detected GCP project ID: ${detectedProjectId}`);
            projectId = detectedProjectId;
          }
        } catch {
          // Continue to error
        }

        if (!projectId) {
          throw new ConfigError(
            'GCP project_id is required. Set it in config, GCLOUD_PROJECT environment variable, or run "gcloud config set project PROJECT_ID".'
          );
        }
      }

      Logger.debug(
        `Fetching secret "${secretName}" from GCP Secret Manager (project: ${projectId})`
      );

      // Fetch secret using gcloud CLI
      const result = execSync(
        `gcloud secrets versions access latest --secret="${secretName}" --project="${projectId}"`,
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      const secretValue = result.trim();
      return processSecretValue(secretName, secretValue);
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      // Handle specific GCP CLI errors
      if (error instanceof Error) {
        const errorMessage = error.message;

        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
          throw new ConfigError(
            `Access denied when fetching secret "${secretName}". Ensure your GCP credentials have permission to access this secret.`
          );
        }

        if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('404')) {
          throw new ConfigError(`Secret "${secretName}" not found in GCP Secret Manager.`);
        }

        if (errorMessage.includes('UNAUTHENTICATED') || errorMessage.includes('401')) {
          throw new ConfigError(
            `Authentication failed when accessing GCP Secret Manager. Ensure you have logged in with 'gcloud auth login' and have valid credentials.`
          );
        }

        throw new ConfigError(
          `Failed to fetch secret "${secretName}" from GCP Secret Manager: ${errorMessage}. Ensure gcloud CLI is installed, you are logged in with 'gcloud auth login', and have valid permissions.`
        );
      }

      throw new ConfigError(`Failed to fetch secret "${secretName}": ${String(error)}`);
    }
  },
};
