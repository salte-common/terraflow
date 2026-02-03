/**
 * Unit tests for plugin loader
 */

import {
  loadBackendPlugin,
  loadSecretsPlugin,
  loadAuthPlugin,
} from '../../src/core/plugin-loader';

describe('plugin-loader', () => {
  describe('loadBackendPlugin', () => {
    it('should load local backend plugin', async () => {
      const plugin = await loadBackendPlugin('local');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('local');
      expect(plugin.validate).toBeDefined();
      expect(plugin.getBackendConfig).toBeDefined();
    });

    it('should throw when backend plugin module fails to load', async () => {
      await expect(loadBackendPlugin('nonexistent-backend-xyz')).rejects.toThrow(
        'Failed to load backend plugin'
      );
      await expect(loadBackendPlugin('nonexistent-backend-xyz')).rejects.toThrow(
        'nonexistent-backend-xyz'
      );
    });

    it('should include original error message when import fails', async () => {
      await expect(loadBackendPlugin('nonexistent-backend-xyz')).rejects.toThrow();
    });
  });

  describe('loadSecretsPlugin', () => {
    it('should load env secrets plugin', async () => {
      const plugin = await loadSecretsPlugin('env');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('env');
    });

    it('should load aws-secrets plugin', async () => {
      const plugin = await loadSecretsPlugin('aws-secrets');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('aws-secrets');
    });

    it('should load gcp-secret-manager plugin', async () => {
      const plugin = await loadSecretsPlugin('gcp-secret-manager');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('gcp-secret-manager');
    });

    it('should load azure-keyvault plugin', async () => {
      const plugin = await loadSecretsPlugin('azure-keyvault');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('azure-keyvault');
    });

    it('should throw when secrets plugin module fails to load', async () => {
      await expect(loadSecretsPlugin('nonexistent-secrets-xyz')).rejects.toThrow(
        'Failed to load secrets plugin'
      );
      await expect(loadSecretsPlugin('nonexistent-secrets-xyz')).rejects.toThrow(
        'nonexistent-secrets-xyz'
      );
    });
  });

  describe('loadAuthPlugin', () => {
    it('should load aws-assume-role auth plugin', async () => {
      const plugin = await loadAuthPlugin('aws-assume-role');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('aws-assume-role');
    });

    it('should load azure-service-principal auth plugin', async () => {
      const plugin = await loadAuthPlugin('azure-service-principal');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('azure-service-principal');
    });

    it('should load gcp-service-account auth plugin', async () => {
      const plugin = await loadAuthPlugin('gcp-service-account');
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('gcp-service-account');
    });

    it('should throw when auth plugin module fails to load', async () => {
      await expect(loadAuthPlugin('nonexistent-auth-xyz')).rejects.toThrow(
        'Failed to load auth plugin'
      );
      await expect(loadAuthPlugin('nonexistent-auth-xyz')).rejects.toThrow(
        'nonexistent-auth-xyz'
      );
    });
  });
});
