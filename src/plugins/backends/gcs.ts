/**
 * GCS backend plugin
 * Handles Google Cloud Storage Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';

// TODO: Implement GCS backend plugin

export const gcsBackend: BackendPlugin = {
  name: 'gcs',
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
