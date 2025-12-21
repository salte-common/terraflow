/**
 * Environment secrets plugin
 * No-op plugin for when users manage secrets via .env files
 *
 * This plugin does not fetch secrets from an external service.
 * Instead, it allows users to manage TF_VAR_* environment variables
 * directly in their .env file or existing environment variables.
 *
 * The .env file is loaded by EnvironmentSetup.loadEnvFile() which
 * does NOT automatically convert variables to TF_VAR_* prefix.
 * Users must manage the TF_VAR_* prefix themselves in .env files.
 *
 * This plugin returns an empty object because:
 * - Secrets come from .env file (loaded separately)
 * - Secrets come from existing environment variables (already available)
 * - No automatic conversion or fetching is performed
 */

import type { SecretsPlugin, SecretsConfig, ExecutionContext } from '../../types';

/**
 * Environment secrets plugin
 * Default and simplest secrets provider - no-op
 */
export const envSecrets: SecretsPlugin = {
  name: 'env',

  /**
   * Validate secrets configuration
   * Always succeeds - no configuration required for env plugin
   * @param _config - Secrets configuration (ignored)
   */
  validate: async (_config: SecretsConfig): Promise<void> => {
    // No validation needed - env plugin is always valid
    // Users manage secrets directly in .env file or environment variables
    return Promise.resolve();
  },

  /**
   * Retrieve secrets
   * Returns empty object because secrets come from .env file or existing env vars
   *
   * This plugin does NOT:
   * - Fetch secrets from external services
   * - Convert environment variables to TF_VAR_* prefix
   * - Load .env files (handled by EnvironmentSetup.loadEnvFile())
   *
   * Users must:
   * - Manage TF_VAR_* prefix themselves in .env files
   * - Set environment variables with TF_VAR_* prefix directly
   * - Or use config.variables section for automatic conversion
   *
   * @param _config - Secrets configuration (ignored)
   * @param _context - Execution context (ignored)
   * @returns Empty object - secrets come from .env or existing env vars
   */
  getSecrets: async (
    _config: SecretsConfig,
    _context: ExecutionContext
  ): Promise<Record<string, string>> => {
    // Return empty object - secrets are already in environment
    // .env file is loaded separately by EnvironmentSetup.loadEnvFile()
    // Existing TF_VAR_* environment variables pass through unchanged
    return {};
  },
};
