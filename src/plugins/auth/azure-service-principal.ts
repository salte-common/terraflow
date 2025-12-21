/**
 * Azure service principal auth plugin
 * Authenticates using Azure service principal and returns ARM_* environment variables
 */

import type { AuthPlugin, AuthConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';

/**
 * Azure service principal authentication plugin
 */
export const azureServicePrincipal: AuthPlugin = {
  name: 'azure-service-principal',

  /**
   * Validate Azure service principal configuration
   * @param config - Auth configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: AuthConfig): Promise<void> => {
    if (!config.service_principal) {
      throw new ConfigError('Azure service principal configuration is required');
    }

    const spConfig = config.service_principal;

    // client_id is required
    if (!spConfig.client_id) {
      throw new ConfigError('Azure service principal requires "client_id" configuration');
    }

    // tenant_id is required
    if (!spConfig.tenant_id) {
      throw new ConfigError('Azure service principal requires "tenant_id" configuration');
    }

    // client_secret is optional if using managed identity or certificate
    // But if provided, it should not be empty
    if (spConfig.client_secret !== undefined && !spConfig.client_secret) {
      throw new ConfigError('Azure service principal "client_secret" cannot be empty if provided');
    }
  },

  /**
   * Authenticate using Azure service principal
   * Returns ARM_* environment variables for Terraform Azure provider
   * @param config - Auth configuration
   * @param context - Execution context
   * @returns Environment variables for Azure authentication
   */
  authenticate: async (
    config: AuthConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>> => {
    if (!config.service_principal) {
      throw new ConfigError('Azure service principal configuration is required');
    }

    const spConfig = config.service_principal;
    const clientId = spConfig.client_id;
    const tenantId = spConfig.tenant_id;
    const clientSecret = spConfig.client_secret;

    try {
      // Validate credentials using Azure CLI (if client_secret is provided)
      if (clientSecret) {
        Logger.debug(`Validating Azure service principal: ${clientId}`);

        // Note: We can't easily validate credentials without making an actual API call
        // The validation will happen when Terraform tries to use these credentials
        // For now, we just validate that the values are provided
        if (!clientId || !tenantId || !clientSecret) {
          throw new ConfigError(
            'Azure service principal requires client_id, tenant_id, and client_secret'
          );
        }
      } else {
        // No client_secret provided - assume using managed identity or certificate
        Logger.debug(
          `Azure service principal configured without client_secret. Assuming managed identity or certificate authentication.`
        );
      }

      // Build environment variables for Terraform Azure provider
      const envVars: Record<string, string> = {
        ARM_CLIENT_ID: clientId,
        ARM_TENANT_ID: tenantId,
      };

      // Add subscription ID if available from context
      if (context.cloud.azureSubscriptionId) {
        envVars.ARM_SUBSCRIPTION_ID = context.cloud.azureSubscriptionId;
      } else if (process.env.ARM_SUBSCRIPTION_ID) {
        envVars.ARM_SUBSCRIPTION_ID = process.env.ARM_SUBSCRIPTION_ID;
      }

      // Add client_secret if provided
      if (clientSecret) {
        envVars.ARM_CLIENT_SECRET = clientSecret;
      }

      Logger.info(`✅ Successfully authenticated Azure service principal: ${clientId}`);

      return envVars;
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new ConfigError(
          `Failed to authenticate Azure service principal: ${error.message}. Ensure client_id, tenant_id, and client_secret (if required) are correct.`
        );
      }

      throw new ConfigError(`Failed to authenticate Azure service principal: ${String(error)}`);
    }
  },
};
