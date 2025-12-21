/**
 * Plugin loader
 * Convention-based plugin discovery and loading
 */

import type { BackendPlugin, SecretsPlugin, AuthPlugin } from '../types/plugins';

/**
 * Load backend plugin by name
 * Convention: src/plugins/backends/{name}.ts exports {name}Backend
 */
export async function loadBackendPlugin(name: string): Promise<BackendPlugin> {
  try {
    // Try to load the plugin module
    const pluginModule = await import(`../plugins/backends/${name}.js`);
    const pluginName = `${name}Backend`;
    const plugin = pluginModule[pluginName];

    if (!plugin) {
      throw new Error(
        `Backend plugin "${name}" not found. Expected export "${pluginName}" from src/plugins/backends/${name}.ts`
      );
    }

    return plugin as BackendPlugin;
  } catch (error) {
    throw new Error(
      `Failed to load backend plugin "${name}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load secrets plugin by name
 * Convention: src/plugins/secrets/{name}.ts exports {name}Secrets or {name}SecretManager
 */
export async function loadSecretsPlugin(name: string): Promise<SecretsPlugin> {
  try {
    const pluginModule = await import(`../plugins/secrets/${name}.js`);

    // Try common naming patterns based on actual plugin exports
    // env -> envSecrets, aws-secrets -> awsSecrets, gcp-secret-manager -> gcpSecretManager
    const pluginName1 =
      name === 'env'
        ? 'envSecrets'
        : name === 'aws-secrets'
          ? 'awsSecrets'
          : name === 'gcp-secret-manager'
            ? 'gcpSecretManager'
            : name === 'azure-keyvault'
              ? 'azureKeyvault'
              : `${name}Secrets`;

    const plugin = pluginModule[pluginName1];

    if (!plugin) {
      // Try to find any exported object with a 'name' property matching our plugin name
      for (const key in pluginModule) {
        const exported = pluginModule[key];
        if (
          exported &&
          typeof exported === 'object' &&
          'name' in exported &&
          exported.name === name
        ) {
          return exported as SecretsPlugin;
        }
      }
      throw new Error(
        `Secrets plugin "${name}" not found. Expected export "${pluginName1}" from src/plugins/secrets/${name}.ts`
      );
    }

    return plugin as SecretsPlugin;
  } catch (error) {
    throw new Error(
      `Failed to load secrets plugin "${name}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load auth plugin by name
 * Convention: src/plugins/auth/{name}.ts exports {name}Auth or camelCase version
 */
export async function loadAuthPlugin(name: string): Promise<AuthPlugin> {
  try {
    const pluginModule = await import(`../plugins/auth/${name}.js`);

    // Try common naming patterns based on actual plugin exports
    // aws-assume-role -> awsAssumeRole
    const pluginName1 =
      name === 'aws-assume-role'
        ? 'awsAssumeRole'
        : name === 'azure-service-principal'
          ? 'azureServicePrincipal'
          : name === 'gcp-service-account'
            ? 'gcpServiceAccount'
            : `${name}Auth`;

    const plugin = pluginModule[pluginName1];

    if (!plugin) {
      // Try to find any exported object with a 'name' property matching our plugin name
      for (const key in pluginModule) {
        const exported = pluginModule[key];
        if (
          exported &&
          typeof exported === 'object' &&
          'name' in exported &&
          exported.name === name
        ) {
          return exported as AuthPlugin;
        }
      }
      throw new Error(
        `Auth plugin "${name}" not found. Expected export "${pluginName1}" from src/plugins/auth/${name}.ts`
      );
    }

    return plugin as AuthPlugin;
  } catch (error) {
    throw new Error(
      `Failed to load auth plugin "${name}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
