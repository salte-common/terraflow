/**
 * Unit tests for GCP Secret Manager secrets plugin
 */

import { gcpSecretManager } from '../../src/plugins/secrets/gcp-secret-manager';
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

describe('gcpSecretManager', () => {
  const mockContext: ExecutionContext = {
    workspace: 'test-workspace',
    workingDir: '/tmp/test',
    hostname: 'test-host',
    env: {},
    cloud: {
      provider: 'gcp',
      gcpProjectId: 'test-project-id',
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
    // Reset env vars
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  describe('validate', () => {
    it('should succeed with valid configuration', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
          project_id: 'my-project',
        },
      };

      await expect(gcpSecretManager.validate(config)).resolves.not.toThrow();
    });

    it('should succeed without project_id if GOOGLE_APPLICATION_CREDENTIALS is set', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/key.json';

      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
        },
      };

      await expect(gcpSecretManager.validate(config)).resolves.not.toThrow();
    });

    it('should throw if config is missing', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
      };

      await expect(gcpSecretManager.validate(config)).rejects.toThrow(ConfigError);
      await expect(gcpSecretManager.validate(config)).rejects.toThrow(
        'GCP Secret Manager requires configuration'
      );
    });

    it('should throw if secret_name is missing', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          project_id: 'my-project',
        },
      };

      await expect(gcpSecretManager.validate(config)).rejects.toThrow(ConfigError);
      await expect(gcpSecretManager.validate(config)).rejects.toThrow('secret_name');
    });
  });

  describe('getSecrets', () => {
    it('should fetch secret and convert to TF_VAR_ format', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
          project_id: 'my-project',
        },
      };

      const mockSecretValue = JSON.stringify({
        db_password: 'secret-password',
        api_key: 'secret-key',
      });

      mockExecSync.mockReturnValueOnce(mockSecretValue);

      const secrets = await gcpSecretManager.getSecrets(config, mockContext);

      expect(secrets).toHaveProperty('TF_VAR_db_password', 'secret-password');
      expect(secrets).toHaveProperty('TF_VAR_api_key', 'secret-key');
      expect(Object.keys(secrets).length).toBe(2);
    });

    it('should use project_id from context if not in config', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
        },
      };

      const mockSecretValue = 'plain-text-secret';
      mockExecSync.mockReturnValueOnce(mockSecretValue);

      const secrets = await gcpSecretManager.getSecrets(config, mockContext);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--project="test-project-id"'),
        expect.anything()
      );
      expect(secrets).toHaveProperty('TF_VAR_my-secret', 'plain-text-secret');
    });

    it('should use project_id from environment if not in config or context', async () => {
      process.env.GCLOUD_PROJECT = 'env-project-id';

      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
        },
      };

      const contextWithoutProject: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'none',
        },
      };

      const mockSecretValue = 'plain-text-secret';
      mockExecSync.mockReturnValueOnce(mockSecretValue);

      await gcpSecretManager.getSecrets(config, contextWithoutProject);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--project="env-project-id"'),
        expect.anything()
      );
    });

    it('should auto-detect project_id from gcloud config if not provided', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
        },
      };

      const contextWithoutProject: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'none',
        },
      };

      // Mock gcloud config get-value project
      mockExecSync
        .mockReturnValueOnce(Buffer.from('detected-project-id'))
        .mockReturnValueOnce(Buffer.from('secret-value'));

      await gcpSecretManager.getSecrets(config, contextWithoutProject);

      expect(mockExecSync).toHaveBeenCalledTimes(2);
      expect(mockExecSync).toHaveBeenNthCalledWith(
        1,
        'gcloud config get-value project',
        expect.anything()
      );
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('--project="detected-project-id"'),
        expect.anything()
      );
    });

    it('should throw ConfigError if project_id cannot be determined', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
        },
      };

      const contextWithoutProject: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'none',
        },
      };

      // Mock gcloud config get-value project to fail
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('gcloud config get-value project')) {
          throw new Error('Command failed');
        }
        throw new Error('Unexpected call');
      });

      await expect(gcpSecretManager.getSecrets(config, contextWithoutProject)).rejects.toThrow(
        ConfigError
      );
      await expect(gcpSecretManager.getSecrets(config, contextWithoutProject)).rejects.toThrow(
        'project_id is required'
      );
    });

    it('should handle non-JSON secret values', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
          project_id: 'my-project',
        },
      };

      const mockSecretValue = 'plain-text-secret-value';
      mockExecSync.mockReturnValueOnce(mockSecretValue);

      const secrets = await gcpSecretManager.getSecrets(config, mockContext);

      expect(secrets).toHaveProperty('TF_VAR_my-secret', 'plain-text-secret-value');
    });

    it('should throw ConfigError if secret not found', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'nonexistent-secret',
          project_id: 'my-project',
        },
      };

      const error = new Error('NOT_FOUND: Secret [nonexistent-secret] not found.');
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      await expect(gcpSecretManager.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(gcpSecretManager.getSecrets(config, mockContext)).rejects.toThrow('not found');
    });

    it('should throw ConfigError if permission denied', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
          project_id: 'my-project',
        },
      };

      const error = new Error('PERMISSION_DENIED: Permission denied.');
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      await expect(gcpSecretManager.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(gcpSecretManager.getSecrets(config, mockContext)).rejects.toThrow(
        'Access denied'
      );
    });

    it('should handle all value types correctly', async () => {
      const config: SecretsConfig = {
        provider: 'gcp-secret-manager',
        config: {
          secret_name: 'my-secret',
          project_id: 'my-project',
        },
      };

      const mockSecretValue = JSON.stringify({
        string_val: 'test',
        number_val: 42,
        bool_val: true,
        null_val: null,
        object_val: { nested: 'value' },
        array_val: [1, 2, 3],
      });

      mockExecSync.mockReturnValueOnce(mockSecretValue);

      const secrets = await gcpSecretManager.getSecrets(config, mockContext);

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
      expect(gcpSecretManager.name).toBe('gcp-secret-manager');
    });

    it('should implement SecretsPlugin interface', () => {
      expect(gcpSecretManager.validate).toBeDefined();
      expect(gcpSecretManager.getSecrets).toBeDefined();
      expect(typeof gcpSecretManager.validate).toBe('function');
      expect(typeof gcpSecretManager.getSecrets).toBe('function');
    });
  });
});

