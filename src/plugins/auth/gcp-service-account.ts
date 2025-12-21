/**
 * GCP service account auth plugin
 * Authenticates using GCP service account key file
 */

import type { AuthPlugin, AuthConfig, ExecutionContext } from '../../types';

// TODO: Implement GCP service account auth plugin

export const gcpServiceAccount: AuthPlugin = {
  name: 'gcp-service-account',
  validate: async (_config: AuthConfig): Promise<void> => {
    // Placeholder
  },
  authenticate: async (
    _config: AuthConfig,
    _context: ExecutionContext
  ): Promise<Record<string, string>> => {
    // Placeholder
    return {};
  },
};
