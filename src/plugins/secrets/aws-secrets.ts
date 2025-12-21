/**
 * AWS Secrets Manager plugin
 * Retrieves secrets from AWS Secrets Manager and converts them to TF_VAR_* environment variables
 *
 * CONVENTION: Every key in the secret automatically becomes TF_VAR_{key}
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';
import type { SecretsPlugin, SecretsConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';

/**
 * AWS Secrets Manager configuration interface
 */
interface AwsSecretsConfig {
  secret_name: string;
  region?: string;
}

/**
 * AWS Secrets Manager secrets plugin
 */
export const awsSecrets: SecretsPlugin = {
  name: 'aws-secrets',

  /**
   * Validate AWS Secrets Manager configuration
   * @param config - Secrets configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: SecretsConfig): Promise<void> => {
    if (!config.config) {
      throw new ConfigError('AWS Secrets Manager requires configuration');
    }

    const awsConfig = config.config as unknown as AwsSecretsConfig;

    // secret_name is required
    if (!awsConfig.secret_name) {
      throw new ConfigError('AWS Secrets Manager requires "secret_name" configuration');
    }

    // region should be set (from config or AWS_REGION env)
    const region = awsConfig.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new ConfigError(
        'AWS Secrets Manager requires "region" configuration or AWS_REGION environment variable'
      );
    }
  },

  /**
   * Retrieve secrets from AWS Secrets Manager
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
      throw new ConfigError('AWS Secrets Manager requires configuration');
    }

    const awsConfig = config.config as unknown as AwsSecretsConfig;
    const secretName = awsConfig.secret_name;

    // Determine region: config > context > env > default
    const region =
      awsConfig.region ||
      context.cloud.awsRegion ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      'us-east-1';

    try {
      Logger.debug(`Fetching secret "${secretName}" from AWS Secrets Manager (region: ${region})`);

      // Create Secrets Manager client
      const client = new SecretsManagerClient({
        region,
      });

      // Get secret value
      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await client.send(command);

      if (!response.SecretString) {
        throw new ConfigError(
          `Secret "${secretName}" exists but does not contain a string value. Binary secrets are not supported.`
        );
      }

      // Parse JSON secret value
      let secretData: Record<string, unknown>;
      try {
        secretData = JSON.parse(response.SecretString);
      } catch (parseError) {
        throw new ConfigError(
          `Secret "${secretName}" does not contain valid JSON. Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
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
        `✅ Loaded ${Object.keys(tfVars).length} Terraform variables from AWS Secrets Manager`
      );

      return tfVars;
    } catch (error) {
      // Handle specific AWS errors
      if (error instanceof ResourceNotFoundException) {
        throw new ConfigError(`Secret "${secretName}" not found in AWS Secrets Manager.`);
      }

      if (
        error instanceof Error &&
        (error.name === 'AccessDeniedException' || error.message.includes('AccessDenied'))
      ) {
        throw new ConfigError(
          `Access denied when fetching secret "${secretName}". Ensure your AWS credentials have permission to read this secret.`
        );
      }

      if (error instanceof ConfigError) {
        // Re-throw ConfigError as-is
        throw error;
      }

      // Generic error handling
      if (error instanceof Error) {
        throw new ConfigError(
          `Failed to fetch secret "${secretName}" from AWS Secrets Manager: ${error.message}. Ensure you have valid AWS credentials and permissions.`
        );
      }

      throw new ConfigError(`Failed to fetch secret "${secretName}": ${String(error)}`);
    }
  },
};
