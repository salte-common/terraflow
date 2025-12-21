/**
 * Local backend plugin
 * Handles local Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';

// TODO: Implement local backend plugin

export const localBackend: BackendPlugin = {
  name: 'local',
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
