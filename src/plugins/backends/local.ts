/**
 * Local backend plugin
 * Handles local Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';

/**
 * Local backend plugin
 * Default backend that stores state locally in terraform.tfstate
 */
export const localBackend: BackendPlugin = {
  name: 'local',

  /**
   * Validate backend configuration
   * Local backend always validates successfully (no configuration needed)
   * @param _config - Backend configuration (ignored for local backend)
   */
  validate: async (_config: BackendConfig): Promise<void> => {
    // Local backend requires no validation
    // State is stored in terraform.tfstate in the working directory
    return Promise.resolve();
  },

  /**
   * Generate Terraform backend configuration arguments
   * Local backend requires no backend-config flags
   * @param _config - Backend configuration (ignored for local backend)
   * @param _context - Execution context (ignored for local backend)
   * @returns Empty array (no backend-config flags needed)
   */
  getBackendConfig: async (
    _config: BackendConfig,
    _context: ExecutionContext
  ): Promise<string[]> => {
    // Local backend doesn't require any -backend-config flags
    // Terraform uses local backend by default if no backend is configured
    return [];
  },
};
