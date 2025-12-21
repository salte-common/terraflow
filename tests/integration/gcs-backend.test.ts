/**
 * Integration tests for GCS backend plugin
 * Tests with mocked GCP CLI
 */

import { gcsBackend } from '../../src/plugins/backends/gcs';
import type { BackendConfig, ExecutionContext } from '../../src/types';
import { ConfigError } from '../../src/core/errors';

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

describe('gcsBackend - Integration', () => {
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
      GCP_PROJECT_ID: 'test-project-id',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Template variable resolution', () => {
    it('should resolve template variables in backend config', async () => {
      const config: BackendConfig = {
        type: 'gcs',
        config: {
          bucket: '${WORKSPACE}-terraform-state',
          prefix: '${HOSTNAME}/state',
        },
      };

      const args = await gcsBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=bucket=test-workspace-terraform-state');
      expect(args).toContain('-backend-config=prefix=test-host/state');
      expect(args).not.toContain('${WORKSPACE}');
      expect(args).not.toContain('${HOSTNAME}');
    });

    it('should use cloud context for GCP template variables', async () => {
      const contextWithGcp: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'gcp',
          gcpProjectId: 'context-project-id',
        },
        templateVars: {
          WORKSPACE: 'test-workspace',
        },
      };

      const config: BackendConfig = {
        type: 'gcs',
        config: {
          bucket: '${GCP_PROJECT_ID}-terraform-state',
        },
      };

      const args = await gcsBackend.getBackendConfig(config, contextWithGcp);

      expect(args).toContain('-backend-config=bucket=context-project-id-terraform-state');
    });
  });

  describe('Default prefix behavior', () => {
    it('should use default prefix when not specified', async () => {
      const config: BackendConfig = {
        type: 'gcs',
        config: {
          bucket: 'my-terraform-state-bucket',
        },
      };

      const args = await gcsBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=prefix=terraform/state');
    });

    it('should use custom prefix when specified', async () => {
      const config: BackendConfig = {
        type: 'gcs',
        config: {
          bucket: 'my-terraform-state-bucket',
          prefix: 'my-custom-prefix',
        },
      };

      const args = await gcsBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=prefix=my-custom-prefix');
    });
  });

  describe('Full backend config generation', () => {
    it('should generate all required backend-config arguments', async () => {
      const config: BackendConfig = {
        type: 'gcs',
        config: {
          bucket: 'my-terraform-state-bucket',
        },
      };

      const args = await gcsBackend.getBackendConfig(config, mockContext);

      // Should have at least bucket + default prefix = 2 arguments
      expect(args.length).toBeGreaterThanOrEqual(2);
      expect(args.every((arg) => arg.startsWith('-backend-config='))).toBe(true);
      expect(args).toContain('-backend-config=bucket=my-terraform-state-bucket');
      expect(args).toContain('-backend-config=prefix=terraform/state');
    });

    it('should generate complete backend config with all optional fields', async () => {
      const config: BackendConfig = {
        type: 'gcs',
        config: {
          bucket: 'my-terraform-state-bucket',
          prefix: 'terraform/state',
          credentials: '/path/to/service-account-key.json',
          impersonate_service_account: 'service-account@project.iam.gserviceaccount.com',
          access_token: 'test-access-token',
          encryption_key: 'test-encryption-key',
        },
      };

      const args = await gcsBackend.getBackendConfig(config, mockContext);

      expect(args.length).toBeGreaterThan(2);
      expect(args).toContain('-backend-config=bucket=my-terraform-state-bucket');
      expect(args).toContain('-backend-config=prefix=terraform/state');
      expect(args).toContain('-backend-config=credentials=/path/to/service-account-key.json');
      expect(args).toContain(
        '-backend-config=impersonate_service_account=service-account@project.iam.gserviceaccount.com'
      );
      expect(args).toContain('-backend-config=access_token=test-access-token');
      expect(args).toContain('-backend-config=encryption_key=test-encryption-key');
    });
  });

  describe('Error handling', () => {
    it('should throw ConfigError if config is missing', async () => {
      const config: BackendConfig = {
        type: 'gcs',
      };

      await expect(gcsBackend.getBackendConfig(config, mockContext)).rejects.toThrow(ConfigError);
    });

    it('should handle missing cloud context gracefully', async () => {
      const contextWithoutGcp: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'none',
        },
        templateVars: {
          WORKSPACE: 'test-workspace',
          HOSTNAME: 'test-host',
        },
      };

      const config: BackendConfig = {
        type: 'gcs',
        config: {
          bucket: 'my-terraform-state-bucket',
        },
      };

      // Should not throw even without GCP cloud context
      const args = await gcsBackend.getBackendConfig(config, contextWithoutGcp);
      expect(args.length).toBeGreaterThanOrEqual(2);
    });
  });
});

