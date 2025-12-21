/**
 * Unit tests for GCP service account auth plugin
 */

import { gcpServiceAccount } from '../../src/plugins/auth/gcp-service-account';
import type { AuthConfig, ExecutionContext } from '../../src/types';
import { ConfigError } from '../../src/core/errors';
import { Logger } from '../../src/utils/logger';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Mock fs
jest.mock('fs');
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

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

describe('gcpServiceAccount', () => {
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

  const mockKeyFile = join(os.tmpdir(), 'test-service-account-key.json');
  const mockKeyData = {
    type: 'service_account',
    project_id: 'test-project-id',
    private_key_id: 'test-key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n',
    client_email: 'test@project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(mockKeyData));
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  describe('validate', () => {
    it('should succeed with valid service account key file', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      await expect(gcpServiceAccount.validate(config)).resolves.not.toThrow();
    });

    it('should throw if service_account config is missing', async () => {
      const config: AuthConfig = {};

      await expect(gcpServiceAccount.validate(config)).rejects.toThrow(ConfigError);
      await expect(gcpServiceAccount.validate(config)).rejects.toThrow(
        'GCP service account configuration is required'
      );
    });

    it('should throw if key_file is missing', async () => {
      const config: AuthConfig = {
        service_account: {},
      } as AuthConfig;

      await expect(gcpServiceAccount.validate(config)).rejects.toThrow(ConfigError);
      await expect(gcpServiceAccount.validate(config)).rejects.toThrow('key_file');
    });

    it('should throw if key file does not exist', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: '/nonexistent/path/key.json',
        },
      };

      mockExistsSync.mockReturnValue(false);

      await expect(gcpServiceAccount.validate(config)).rejects.toThrow(ConfigError);
      await expect(gcpServiceAccount.validate(config)).rejects.toThrow('does not exist');
    });

    it('should throw if key file is not valid JSON', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      mockReadFileSync.mockReturnValue('invalid json content');

      await expect(gcpServiceAccount.validate(config)).rejects.toThrow(ConfigError);
      await expect(gcpServiceAccount.validate(config)).rejects.toThrow('not valid JSON');
    });

    it('should throw if key file type is not service_account', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      const invalidKeyData = {
        type: 'user_account',
        project_id: 'test-project-id',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(invalidKeyData));

      await expect(gcpServiceAccount.validate(config)).rejects.toThrow(ConfigError);
      await expect(gcpServiceAccount.validate(config)).rejects.toThrow('service_account');
    });

    it('should warn if key file does not contain project_id', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      const keyDataWithoutProject = {
        ...mockKeyData,
        project_id: undefined,
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(keyDataWithoutProject));

      await expect(gcpServiceAccount.validate(config)).resolves.not.toThrow();
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('does not contain project_id')
      );
    });
  });

  describe('authenticate', () => {
    it('should return GOOGLE_APPLICATION_CREDENTIALS environment variable', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      const envVars = await gcpServiceAccount.authenticate(config, mockContext);

      expect(envVars).toHaveProperty('GOOGLE_APPLICATION_CREDENTIALS', mockKeyFile);
    });

    it('should include project ID environment variables from key file', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      const envVars = await gcpServiceAccount.authenticate(config, mockContext);

      expect(envVars).toHaveProperty('GCLOUD_PROJECT', 'test-project-id');
      expect(envVars).toHaveProperty('GCP_PROJECT', 'test-project-id');
      expect(envVars).toHaveProperty('GOOGLE_CLOUD_PROJECT', 'test-project-id');
    });

    it('should use project ID from context if not in key file', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      const keyDataWithoutProject = {
        ...mockKeyData,
        project_id: undefined,
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(keyDataWithoutProject));

      const envVars = await gcpServiceAccount.authenticate(config, mockContext);

      expect(envVars).toHaveProperty('GCLOUD_PROJECT', 'test-project-id');
      expect(envVars).toHaveProperty('GCP_PROJECT', 'test-project-id');
      expect(envVars).toHaveProperty('GOOGLE_CLOUD_PROJECT', 'test-project-id');
    });

    it('should use project ID from environment if not in key file or context', async () => {
      process.env.GCLOUD_PROJECT = 'env-project-id';

      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      const keyDataWithoutProject = {
        ...mockKeyData,
        project_id: undefined,
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(keyDataWithoutProject));

      const contextWithoutProject: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'none',
        },
      };

      const envVars = await gcpServiceAccount.authenticate(config, contextWithoutProject);

      expect(envVars).toHaveProperty('GCLOUD_PROJECT', 'env-project-id');
      expect(envVars).toHaveProperty('GCP_PROJECT', 'env-project-id');
      expect(envVars).toHaveProperty('GOOGLE_CLOUD_PROJECT', 'env-project-id');
    });

    it('should not include project ID env vars if not available anywhere', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      const keyDataWithoutProject = {
        ...mockKeyData,
        project_id: undefined,
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(keyDataWithoutProject));

      const contextWithoutProject: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'none',
        },
      };

      const envVars = await gcpServiceAccount.authenticate(config, contextWithoutProject);

      expect(envVars).toHaveProperty('GOOGLE_APPLICATION_CREDENTIALS', mockKeyFile);
      expect(envVars).not.toHaveProperty('GCLOUD_PROJECT');
    });

    it('should throw if service_account config is missing', async () => {
      const config: AuthConfig = {};

      await expect(gcpServiceAccount.authenticate(config, mockContext)).rejects.toThrow(
        ConfigError
      );
    });

    it('should log success message', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      await gcpServiceAccount.authenticate(config, mockContext);

      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully configured GCP service account')
      );
    });

    it('should handle file read errors', async () => {
      const config: AuthConfig = {
        service_account: {
          key_file: mockKeyFile,
        },
      };

      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(gcpServiceAccount.authenticate(config, mockContext)).rejects.toThrow(
        ConfigError
      );
      await expect(gcpServiceAccount.authenticate(config, mockContext)).rejects.toThrow(
        'Failed to read'
      );
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(gcpServiceAccount.name).toBe('gcp-service-account');
    });

    it('should implement AuthPlugin interface', () => {
      expect(gcpServiceAccount.validate).toBeDefined();
      expect(gcpServiceAccount.authenticate).toBeDefined();
      expect(typeof gcpServiceAccount.validate).toBe('function');
      expect(typeof gcpServiceAccount.authenticate).toBe('function');
    });
  });
});

