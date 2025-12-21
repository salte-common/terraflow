/**
 * Azure service principal auth plugin
 * Authenticates using Azure service principal
 */

import type { AuthPlugin, AuthConfig, ExecutionContext } from '../../types';

// TODO: Implement Azure service principal auth plugin

export const azureServicePrincipal: AuthPlugin = {
  name: 'azure-service-principal',
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
