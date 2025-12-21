/**
 * Unit tests for Azure Key Vault secrets plugin
 */

import { azureKeyvault } from '../../src/plugins/secrets/azure-keyvault';
import type { SecretsConfig, ExecutionContext } from '../../src/types';
import { ConfigError } from '../../src/core/errors';
import * as child_process from 'child_process';

// Mock child_process
jest.mock('child_process');
const mockExecSync = child_process.execSync as jest.MockedFunction<typeof child_process.execSync>;

// Mock Logger
jest.mock('../../src/utils/logger', () => {
  const actualLogger = jest.requireActual('../../src/utils/logger');
  return {
    Logger: {
      ...actualLogger.Logger,
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
});

describe('azureKeyvault', () => {
  const mockContext: ExecutionContext = {
    workspace: 'test-workspace',
    workingDir: '/tmp/test',
    hostname: 'test-host',
    env: {},
    cloud: {
      provider: 'azure',
      azureSubscriptionId: 'test-subscription-id',
      azureTenantId: 'test-tenant-id',
    },
    vcs: {
      branch: 'main',
      tag: undefined,
      commitSha: 'abc123',
      shortSha: 'abc123',
      isClean: true,
      githubRepository: undefined,
      gitlabProjectPath: undefined,
    },
    templateVars: {
      WORKSPACE: 'test-workspace',
      HOSTNAME: 'test-host',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should succeed with valid configuration', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'my-keyvault',
        },
      };

      await expect(azureKeyvault.validate(config)).resolves.not.toThrow();
    });

    it('should throw if config is missing', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
      };

      await expect(azureKeyvault.validate(config)).rejects.toThrow(ConfigError);
      await expect(azureKeyvault.validate(config)).rejects.toThrow(
        'Azure Key Vault requires configuration'
      );
    });

    it('should throw if vault_name is missing', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {},
      };

      await expect(azureKeyvault.validate(config)).rejects.toThrow(ConfigError);
      await expect(azureKeyvault.validate(config)).rejects.toThrow('vault_name');
    });
  });

  describe('getSecrets', () => {
    it('should fetch single secret and convert to TF_VAR_ format', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'my-keyvault',
          secret_name: 'my-secret',
        },
      };

      const mockSecretResponse = {
        value: JSON.stringify({
          db_password: 'secret-password',
          api_key: 'secret-key',
        }),
      };

      mockExecSync.mockReturnValueOnce(Buffer.from(JSON.stringify(mockSecretResponse)));

      const secrets = await azureKeyvault.getSecrets(config, mockContext);

      expect(secrets).toHaveProperty('TF_VAR_db_password', 'secret-password');
      expect(secrets).toHaveProperty('TF_VAR_api_key', 'secret-key');
      expect(Object.keys(secrets).length).toBe(2);
    });

    it('should handle non-JSON secret values', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'my-keyvault',
          secret_name: 'my-secret',
        },
      };

      const mockSecretResponse = {
        value: 'plain-text-secret-value',
      };

      mockExecSync.mockReturnValueOnce(Buffer.from(JSON.stringify(mockSecretResponse)));

      const secrets = await azureKeyvault.getSecrets(config, mockContext);

      expect(secrets).toHaveProperty('TF_VAR_my-secret', 'plain-text-secret-value');
    });

    it('should fetch all secrets when secret_name is not provided', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'my-keyvault',
        },
      };

      const mockSecretList = [
        { name: 'secret1' },
        { name: 'secret2' },
      ];

      const mockSecret1 = { value: 'value1' };
      const mockSecret2 = { value: 'value2' };

      mockExecSync
        .mockReturnValueOnce(Buffer.from(JSON.stringify(mockSecretList)))
        .mockReturnValueOnce(Buffer.from(JSON.stringify(mockSecret1)))
        .mockReturnValueOnce(Buffer.from(JSON.stringify(mockSecret2)));

      const secrets = await azureKeyvault.getSecrets(config, mockContext);

      expect(secrets).toHaveProperty('TF_VAR_secret1', 'value1');
      expect(secrets).toHaveProperty('TF_VAR_secret2', 'value2');
    });

    it('should throw ConfigError if vault not found', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'nonexistent-vault',
          secret_name: 'my-secret',
        },
      };

      const error = new Error('(VaultNotFound) The specified vault does not exist.');
      Object.defineProperty(error, 'status', { value: 404 });
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      await expect(azureKeyvault.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(azureKeyvault.getSecrets(config, mockContext)).rejects.toThrow('not found');
    });

    it('should throw ConfigError if secret not found', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'my-keyvault',
          secret_name: 'nonexistent-secret',
        },
      };

      const error = new Error('(SecretNotFound) The specified secret does not exist.');
      Object.defineProperty(error, 'status', { value: 404 });
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      await expect(azureKeyvault.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(azureKeyvault.getSecrets(config, mockContext)).rejects.toThrow('not found');
    });

    it('should throw ConfigError if authentication fails', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'my-keyvault',
          secret_name: 'my-secret',
        },
      };

      const error = new Error('(Unauthorized) Authentication failed.');
      Object.defineProperty(error, 'status', { value: 401 });
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      await expect(azureKeyvault.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(azureKeyvault.getSecrets(config, mockContext)).rejects.toThrow(
        'Authentication failed'
      );
    });

    it('should handle all value types correctly', async () => {
      const config: SecretsConfig = {
        provider: 'azure-keyvault',
        config: {
          vault_name: 'my-keyvault',
          secret_name: 'my-secret',
        },
      };

      const mockSecretResponse = {
        value: JSON.stringify({
          string_val: 'test',
          number_val: 42,
          bool_val: true,
          null_val: null,
          object_val: { nested: 'value' },
          array_val: [1, 2, 3],
        }),
      };

      mockExecSync.mockReturnValueOnce(Buffer.from(JSON.stringify(mockSecretResponse)));

      const secrets = await azureKeyvault.getSecrets(config, mockContext);

      expect(secrets['TF_VAR_string_val']).toBe('test');
      expect(secrets['TF_VAR_number_val']).toBe('42');
      expect(secrets['TF_VAR_bool_val']).toBe('true');
      expect(secrets['TF_VAR_null_val']).toBe('');
      expect(secrets['TF_VAR_object_val']).toBe(JSON.stringify({ nested: 'value' }));
      expect(secrets['TF_VAR_array_val']).toBe(JSON.stringify([1, 2, 3]));
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(azureKeyvault.name).toBe('azure-keyvault');
    });

    it('should implement SecretsPlugin interface', () => {
      expect(azureKeyvault.validate).toBeDefined();
      expect(azureKeyvault.getSecrets).toBeDefined();
      expect(typeof azureKeyvault.validate).toBe('function');
      expect(typeof azureKeyvault.getSecrets).toBe('function');
    });
  });
});

