/**
 * Azure Key Vault secrets plugin
 * Retrieves secrets from Azure Key Vault and converts them to TF_VAR_* environment variables
 *
 * CONVENTION: Every key in the secret automatically becomes TF_VAR_{key}
 */

import { execSync } from 'child_process';
import type { SecretsPlugin, SecretsConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';

/**
 * Azure Key Vault configuration interface
 */
interface AzureKeyVaultConfig {
  vault_name: string;
  secret_name?: string; // Optional: if not provided, fetches all secrets from vault
}

/**
 * Azure Key Vault secrets plugin
 */
export const azureKeyvault: SecretsPlugin = {
  name: 'azure-keyvault',

  /**
   * Validate Azure Key Vault configuration
   * @param config - Secrets configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: SecretsConfig): Promise<void> => {
    if (!config.config) {
      throw new ConfigError('Azure Key Vault requires configuration');
    }

    const azureConfig = config.config as unknown as AzureKeyVaultConfig;

    // vault_name is required
    if (!azureConfig.vault_name) {
      throw new ConfigError('Azure Key Vault requires "vault_name" configuration');
    }
  },

  /**
   * Retrieve secrets from Azure Key Vault using Azure CLI
   * All keys are automatically prefixed with TF_VAR_
   * @param config - Secrets configuration
   * @param _context - Execution context (unused but required by interface)
   * @returns Record of environment variable key-value pairs (prefixed with TF_VAR_)
   */
  getSecrets: async (
    config: SecretsConfig,
    _context: ExecutionContext
  ): Promise<Record<string, string>> => {
    if (!config.config) {
      throw new ConfigError('Azure Key Vault requires configuration');
    }

    const azureConfig = config.config as unknown as AzureKeyVaultConfig;
    const vaultName = azureConfig.vault_name;
    const secretName = azureConfig.secret_name;

    try {
      Logger.debug(`Fetching secret from Azure Key Vault: ${vaultName}`);

      const tfVars: Record<string, string> = {};

      if (secretName) {
        // Fetch single secret using Azure CLI
        Logger.debug(`Fetching secret "${secretName}" from Azure Key Vault`);
        try {
          const result = execSync(
            `az keyvault secret show --vault-name ${vaultName} --name ${secretName} --output json`,
            {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
            }
          );

          const secretResponse = JSON.parse(result);
          const secretValue = secretResponse.value;

          if (!secretValue) {
            throw new ConfigError(`Secret "${secretName}" exists but does not contain a value.`);
          }

          // Try to parse as JSON
          try {
            const secretData = JSON.parse(secretValue);
            if (
              typeof secretData === 'object' &&
              secretData !== null &&
              !Array.isArray(secretData)
            ) {
              // It's a JSON object, extract key-value pairs
              for (const key in secretData) {
                if (Object.prototype.hasOwnProperty.call(secretData, key)) {
                  const value = secretData[key];
                  const tfVarKey = `TF_VAR_${key}`;

                  if (value === null || value === undefined) {
                    tfVars[tfVarKey] = '';
                  } else if (typeof value === 'string') {
                    tfVars[tfVarKey] = value;
                  } else if (typeof value === 'number' || typeof value === 'boolean') {
                    tfVars[tfVarKey] = String(value);
                  } else {
                    tfVars[tfVarKey] = JSON.stringify(value);
                  }
                }
              }
            } else {
              // Not a JSON object, treat the entire secret value as a single key
              const tfVarKey = `TF_VAR_${secretName}`;
              tfVars[tfVarKey] = secretValue;
            }
          } catch {
            // Not valid JSON, treat the entire secret value as a single key
            const tfVarKey = `TF_VAR_${secretName}`;
            tfVars[tfVarKey] = secretValue;
          }
        } catch (error) {
          if (error instanceof ConfigError) {
            throw error;
          }

          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('(SecretNotFound)') || errorMessage.includes('404')) {
            throw new ConfigError(
              `Secret "${secretName}" not found in Azure Key Vault "${vaultName}".`
            );
          }
          throw error;
        }
      } else {
        // List all secrets in the vault and fetch their values using Azure CLI
        Logger.debug('Fetching all secrets from Azure Key Vault');
        try {
          const listResult = execSync(
            `az keyvault secret list --vault-name ${vaultName} --output json`,
            {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
            }
          );

          const secrets = JSON.parse(listResult);

          for (const secretProperties of secrets) {
            if (secretProperties.name) {
              try {
                const secretResult = execSync(
                  `az keyvault secret show --vault-name ${vaultName} --name ${secretProperties.name} --output json`,
                  {
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                  }
                );

                const secretResponse = JSON.parse(secretResult);
                if (secretResponse.value) {
                  const tfVarKey = `TF_VAR_${secretProperties.name}`;
                  tfVars[tfVarKey] = secretResponse.value;
                }
              } catch (error) {
                // Skip secrets we can't read (might not have permissions)
                Logger.debug(
                  `Skipping secret "${secretProperties.name}": ${error instanceof Error ? error.message : String(error)}`
                );
              }
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('(VaultNotFound)') || errorMessage.includes('404')) {
            throw new ConfigError(`Azure Key Vault "${vaultName}" not found.`);
          }
          throw error;
        }
      }

      Logger.info(
        `✅ Loaded ${Object.keys(tfVars).length} Terraform variables from Azure Key Vault`
      );

      return tfVars;
    } catch (error) {
      // Handle specific Azure CLI errors
      if (error instanceof ConfigError) {
        throw error;
      }

      if (error instanceof Error) {
        const errorMessage = error.message;

        if (errorMessage.includes('(Unauthorized)') || errorMessage.includes('401')) {
          throw new ConfigError(
            `Authentication failed when accessing Azure Key Vault "${vaultName}". Ensure you have logged in with 'az login' and have valid permissions.`
          );
        }

        if (errorMessage.includes('(Forbidden)') || errorMessage.includes('403')) {
          throw new ConfigError(
            `Access denied when accessing Azure Key Vault "${vaultName}". Ensure your Azure credentials have permission to read secrets from this vault.`
          );
        }

        if (errorMessage.includes('(VaultNotFound)')) {
          throw new ConfigError(`Azure Key Vault "${vaultName}" not found.`);
        }

        if (
          errorMessage.includes('(SecretNotFound)') ||
          (errorMessage.includes('404') && secretName)
        ) {
          throw new ConfigError(
            `Secret "${secretName}" not found in Azure Key Vault "${vaultName}".`
          );
        }

        throw new ConfigError(
          `Failed to fetch secrets from Azure Key Vault "${vaultName}": ${errorMessage}. Ensure Azure CLI is installed, you are logged in with 'az login', and have valid permissions.`
        );
      }

      throw new ConfigError(
        `Failed to fetch secrets from Azure Key Vault "${vaultName}": ${String(error)}`
      );
    }
  },
};
