/**
 * Azure RM backend plugin
 * Handles Azure Resource Manager Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';

// TODO: Implement Azure RM backend plugin

export const azurermBackend: BackendPlugin = {
  name: 'azurerm',
  validate: async (_config: BackendConfig): Promise<void> => {
    // Placeholder
  },
  getBackendConfig: async (
    _config: BackendConfig,
    _context: ExecutionContext
  ): Promise<string[]> => {
    // Placeholder
    return [];
  },
};
