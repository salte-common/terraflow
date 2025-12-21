/**
 * Integration tests for Azure RM backend plugin
 * Tests with mocked Azure CLI
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
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
});

describe('azurermBackend - Integration', () => {
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
      AZURE_SUBSCRIPTION_ID: 'test-subscription-id',
      AZURE_TENANT_ID: 'test-tenant-id',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Template variable resolution', () => {
    it('should resolve template variables in backend config', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: '${WORKSPACE}-storage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          subscription_id: '${AZURE_SUBSCRIPTION_ID}',
          tenant_id: '${AZURE_TENANT_ID}',
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      expect(args).toContain('-backend-config=storage_account_name=test-workspace-storage');
      expect(args).toContain('-backend-config=subscription_id=test-subscription-id');
      expect(args).toContain('-backend-config=tenant_id=test-tenant-id');
      expect(args).not.toContain('${WORKSPACE}');
      expect(args).not.toContain('${AZURE_SUBSCRIPTION_ID}');
    });

    it('should use cloud context for Azure template variables', async () => {
      const contextWithAzure: ExecutionContext = {
        ...mockContext,
        cloud: {
          provider: 'azure',
          azureSubscriptionId: 'context-subscription-id',
          azureTenantId: 'context-tenant-id',
        },
        templateVars: {
          WORKSPACE: 'test-workspace',
        },
      };

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

      const args = await azurermBackend.getBackendConfig(config, contextWithAzure);

      expect(args).toContain('-backend-config=subscription_id=context-subscription-id');
      expect(args).toContain('-backend-config=tenant_id=context-tenant-id');
    });
  });

  describe('Full backend config generation', () => {
    it('should generate all required backend-config arguments', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      // Should have at least the 3 required fields
      expect(args.length).toBeGreaterThanOrEqual(3);
      expect(args.every((arg) => arg.startsWith('-backend-config='))).toBe(true);
    });

    it('should generate complete backend config with all optional fields', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          resource_group_name: 'my-resource-group',
          subscription_id: 'sub-123',
          tenant_id: 'tenant-456',
          client_id: 'client-789',
          use_msi: true,
          environment: 'public',
        },
      };

      const args = await azurermBackend.getBackendConfig(config, mockContext);

      expect(args.length).toBeGreaterThan(3);
      expect(args).toContain('-backend-config=storage_account_name=mystorageaccount');
      expect(args).toContain('-backend-config=container_name=tfstate');
      expect(args).toContain('-backend-config=key=terraform.tfstate');
      expect(args).toContain('-backend-config=resource_group_name=my-resource-group');
      expect(args).toContain('-backend-config=subscription_id=sub-123');
      expect(args).toContain('-backend-config=tenant_id=tenant-456');
      expect(args).toContain('-backend-config=client_id=client-789');
      expect(args).toContain('-backend-config=use_msi=true');
      expect(args).toContain('-backend-config=environment=public');
    });
  });

  describe('Error handling', () => {
    it('should throw ConfigError if config is missing', async () => {
      const config: BackendConfig = {
        type: 'azurerm',
      };

      await expect(azurermBackend.getBackendConfig(config, mockContext)).rejects.toThrow(
        ConfigError
      );
    });

    it('should handle missing cloud context gracefully', async () => {
      const contextWithoutAzure: ExecutionContext = {
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
        type: 'azurerm',
        config: {
          storage_account_name: 'mystorageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      };

      // Should not throw even without Azure cloud context
      const args = await azurermBackend.getBackendConfig(config, contextWithoutAzure);
      expect(args.length).toBeGreaterThanOrEqual(3);
    });
  });
});

