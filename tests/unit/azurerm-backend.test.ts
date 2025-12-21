/**
 * Unit tests for Azure RM backend plugin
 */

import { azurermBackend } from '../../src/plugins/backends/azurerm';
import type { BackendConfig, ExecutionContext } from '../../src/types';
import { ConfigError } from '../../src/core/errors';

// Mock Logger
jest.mock('../../src/utils/logger', () => {
  const actualLogger = jest.requireActual('../../src/utils/logger');
  return {
    Logger: {
      ...actualLogger.Logger,
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
});

describe('azurermBackend', () => {
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
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      };

      await expect(azurermBackend.validate(config)).resolves.not.toThrow();
    });

    it('should throw if config is missing', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
      };

      await expect(azurermBackend.validate(config)).rejects.toThrow(ConfigError);
      await expect(azurermBackend.validate(config)).rejects.toThrow(
        'Azure RM backend requires configuration'
      );
    });

    it('should throw if storage_account_name is missing', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      };

      await expect(azurermBackend.validate(config)).rejects.toThrow(ConfigError);
      await expect(azurermBackend.validate(config)).rejects.toThrow(
        'storage_account_name'
      );
    });

    it('should throw if container_name is missing', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          key: 'terraform.tfstate',
        },
      };

      await expect(azurermBackend.validate(config)).rejects.toThrow(ConfigError);
      await expect(azurermBackend.validate(config)).rejects.toThrow('container_name');
    });

    it('should throw if key is missing', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
        },
      };

      await expect(azurermBackend.validate(config)).rejects.toThrow(ConfigError);
      await expect(azurermBackend.validate(config)).rejects.toThrow(
        'key'
      );
    });
  });

  describe('getBackendConfig', () => {
    it('should generate backend-config arguments for required fields', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=storage_account_name=mystorageaccount');
      expect(args).toContain('-backend-config=container_name=tfstate');
      expect(args).toContain('-backend-config=key=terraform.tfstate');
    });

    it('should include optional fields when provided', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          resource_group_name: 'my-resource-group',
          subscription_id: 'custom-subscription-id',
          tenant_id: 'custom-tenant-id',
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=resource_group_name=my-resource-group');
      expect(args).toContain('-backend-config=subscription_id=custom-subscription-id');
      expect(args).toContain('-backend-config=tenant_id=custom-tenant-id');
    });

    it('should resolve template variables in config', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: '${WORKSPACE}-state',
          key: 'terraform.tfstate',
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=container_name=test-workspace-state');
      expect(args).not.toContain('${WORKSPACE}');
    });

    it('should use cloud context variables for templates', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          subscription_id: '${AZURE_SUBSCRIPTION_ID}',
          tenant_id: '${AZURE_TENANT_ID}',
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=subscription_id=test-subscription-id');
      expect(args).toContain('-backend-config=tenant_id=test-tenant-id');
    });

    it('should throw if config is missing', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
      };

      await expect(azurermBackend.getBackendConfig(config, mockContext)).rejects.toThrow(
        ConfigError
      );
    });

    it('should handle all optional Azure RM backend fields', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          client_certificate_path: '/path/to/cert.pfx',
          client_certificate_password: 'cert-password',
          use_msi: true,
          msi_endpoint: 'http://169.254.169.254/metadata/identity/oauth2/token',
          environment: 'public',
          endpoint: 'https://mystorageaccount.blob.core.windows.net',
          sas_token: 'test-sas-token',
          access_key: 'test-access-key',
          snapshot: true,
          encryption: true,
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      expect(args.length).toBeGreaterThan(3); // At least the required fields
      expect(args).toContain('-backend-config=client_id=test-client-id');
      expect(args).toContain('-backend-config=client_secret=test-client-secret');
      expect(args).toContain('-backend-config=use_msi=true');
      expect(args).toContain('-backend-config=snapshot=true');
      expect(args).toContain('-backend-config=encryption=true');
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(azurermBackend.name).toBe('azurerm');
    });

    it('should implement BackendPlugin interface', () => {
      expect(azurermBackend.validate).toBeDefined();
      expect(azurermBackend.getBackendConfig).toBeDefined();
      expect(typeof azurermBackend.validate).toBe('function');
      expect(typeof azurermBackend.getBackendConfig).toBe('function');
    });
  });
});

