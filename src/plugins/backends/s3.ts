/**
 * S3 backend plugin
 * Handles AWS S3 Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';

// TODO: Implement S3 backend plugin

export const s3Backend: BackendPlugin = {
  name: 's3',
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
