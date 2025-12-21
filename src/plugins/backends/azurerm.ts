/**
 * Azure RM backend plugin
 * Handles Azure Resource Manager Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';
import { TemplateUtils } from '../../utils/templates';

/**
 * Azure RM backend configuration interface
 */
interface AzureRMBackendConfig {
  storage_account_name: string;
  container_name: string;
  key: string;
  resource_group_name?: string;
  subscription_id?: string;
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  client_certificate_path?: string;
  client_certificate_password?: string;
  use_msi?: boolean;
  msi_endpoint?: string;
  environment?: string;
  endpoint?: string;
  sas_token?: string;
  access_key?: string;
  snapshot?: boolean;
  encryption?: boolean;
}

/**
 * Azure RM backend plugin
 */
export const azurermBackend: BackendPlugin = {
  name: 'azurerm',

  /**
   * Validate Azure RM backend configuration
   * @param config - Backend configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: BackendConfig): Promise<void> => {
    if (!config.config) {
      throw new ConfigError('Azure RM backend requires configuration');
    }

    const azureConfig = config.config as unknown as AzureRMBackendConfig;

    // Required fields
    if (!azureConfig.storage_account_name) {
      throw new ConfigError('Azure RM backend requires "storage_account_name" configuration');
    }

    if (!azureConfig.container_name) {
      throw new ConfigError('Azure RM backend requires "container_name" configuration');
    }

    if (!azureConfig.key) {
      throw new ConfigError('Azure RM backend requires "key" configuration');
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
      throw new ConfigError('Azure RM backend requires configuration');
    }

    // Build template context from execution context
    const templateVars: Record<string, string> = {
      ...context.templateVars,
    };

    // Add cloud-specific variables
    if (context.cloud.azureSubscriptionId) {
      templateVars.AZURE_SUBSCRIPTION_ID = context.cloud.azureSubscriptionId;
    }
    if (context.cloud.azureTenantId) {
      templateVars.AZURE_TENANT_ID = context.cloud.azureTenantId;
    }

    // Resolve template variables in config
    const resolvedConfig = TemplateUtils.resolveObject(config.config, templateVars) as Record<
      string,
      unknown
    >;

    const azureConfig = resolvedConfig as unknown as AzureRMBackendConfig;

    // Build backend-config arguments
    const backendArgs: string[] = [];

    // Required fields
    backendArgs.push(`-backend-config=storage_account_name=${azureConfig.storage_account_name}`);
    backendArgs.push(`-backend-config=container_name=${azureConfig.container_name}`);
    backendArgs.push(`-backend-config=key=${azureConfig.key}`);

    // Optional fields
    if (azureConfig.resource_group_name) {
      backendArgs.push(`-backend-config=resource_group_name=${azureConfig.resource_group_name}`);
    }
    if (azureConfig.subscription_id) {
      backendArgs.push(`-backend-config=subscription_id=${azureConfig.subscription_id}`);
    }
    if (azureConfig.tenant_id) {
      backendArgs.push(`-backend-config=tenant_id=${azureConfig.tenant_id}`);
    }
    if (azureConfig.client_id) {
      backendArgs.push(`-backend-config=client_id=${azureConfig.client_id}`);
    }
    if (azureConfig.client_secret) {
      backendArgs.push(`-backend-config=client_secret=${azureConfig.client_secret}`);
    }
    if (azureConfig.client_certificate_path) {
      backendArgs.push(
        `-backend-config=client_certificate_path=${azureConfig.client_certificate_path}`
      );
    }
    if (azureConfig.client_certificate_password) {
      backendArgs.push(
        `-backend-config=client_certificate_password=${azureConfig.client_certificate_password}`
      );
    }
    if (azureConfig.use_msi !== undefined) {
      backendArgs.push(`-backend-config=use_msi=${azureConfig.use_msi}`);
    }
    if (azureConfig.msi_endpoint) {
      backendArgs.push(`-backend-config=msi_endpoint=${azureConfig.msi_endpoint}`);
    }
    if (azureConfig.environment) {
      backendArgs.push(`-backend-config=environment=${azureConfig.environment}`);
    }
    if (azureConfig.endpoint) {
      backendArgs.push(`-backend-config=endpoint=${azureConfig.endpoint}`);
    }
    if (azureConfig.sas_token) {
      backendArgs.push(`-backend-config=sas_token=${azureConfig.sas_token}`);
    }
    if (azureConfig.access_key) {
      backendArgs.push(`-backend-config=access_key=${azureConfig.access_key}`);
    }
    if (azureConfig.snapshot !== undefined) {
      backendArgs.push(`-backend-config=snapshot=${azureConfig.snapshot}`);
    }
    if (azureConfig.encryption !== undefined) {
      backendArgs.push(`-backend-config=encryption=${azureConfig.encryption}`);
    }

    Logger.debug(`Generated ${backendArgs.length} backend-config arguments for Azure RM backend`);

    return backendArgs;
  },
};
