/**
 * Integration tests for AWS Secrets Manager secrets plugin
 * Tests the full secret retrieval and TF_VAR conversion flow
 */

import { awsSecrets } from '../../src/plugins/secrets/aws-secrets';
import type { SecretsConfig, ExecutionContext } from '../../src/types';

// Mock AWS SDK at the module level
jest.mock('@aws-sdk/client-secrets-manager', () => {
  const mockSend = jest.fn();
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    GetSecretValueCommand: jest.fn().mockImplementation((params) => params),
    ResourceNotFoundException: class ResourceNotFoundException extends Error {
      constructor(message?: string) {
        super(message);
        this.name = 'ResourceNotFoundException';
      }
    },
    __mockSend: mockSend,
  };
});

describe('AWS Secrets Manager - Integration', () => {
  const mockContext: ExecutionContext = {
    workspace: 'test',
    workingDir: '/tmp/test',
    cloud: { provider: 'aws', awsRegion: 'us-east-1', awsAccountId: '123456789012' },
    vcs: {},
    hostname: 'test-host',
    env: {},
    templateVars: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { __mockSend } = require('@aws-sdk/client-secrets-manager');
    __mockSend.mockClear();
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
  });

  describe('Full secret retrieval and TF_VAR conversion', () => {
    it('should complete full flow: fetch secret, parse JSON, convert to TF_VAR_', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'us-east-1',
        },
      };

      const { __mockSend, GetSecretValueCommand, SecretsManagerClient } =
        require('@aws-sdk/client-secrets-manager');

      // Mock secret with various value types
      __mockSend.mockResolvedValue({
        SecretString: JSON.stringify({
          environment: 'production',
          instance_count: 3,
          enabled: true,
          tags: { env: 'prod', app: 'web' },
          zones: ['us-east-1a', 'us-east-1b'],
        }),
      });

      // Validate first
      await expect(awsSecrets.validate(config)).resolves.not.toThrow();

      // Then get secrets
      const secrets = await awsSecrets.getSecrets(config, mockContext);

      // Verify all keys have TF_VAR_ prefix
      expect(secrets).toEqual({
        TF_VAR_environment: 'production',
        TF_VAR_instance_count: '3',
        TF_VAR_enabled: 'true',
        TF_VAR_tags: '{"env":"prod","app":"web"}',
        TF_VAR_zones: '["us-east-1a","us-east-1b"]',
      });

      // Verify AWS SDK was called correctly
      expect(SecretsManagerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
        })
      );

      expect(GetSecretValueCommand).toHaveBeenCalledWith({
        SecretId: 'myapp/terraform-vars',
      });

      expect(__mockSend).toHaveBeenCalledTimes(1);
    });

    it('should use region from context when not in config', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
        },
      };

      const contextWithRegion: ExecutionContext = {
        ...mockContext,
        cloud: { provider: 'aws', awsRegion: 'us-west-2' },
      };

      const { __mockSend, SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockResolvedValue({
        SecretString: JSON.stringify({ test: 'value' }),
      });

      await awsSecrets.getSecrets(config, contextWithRegion);

      expect(SecretsManagerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-west-2',
        })
      );
    });

    it('should use region from environment when not in config or context', async () => {
      process.env.AWS_REGION = 'eu-west-1';
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
        },
      };

      const contextWithoutRegion: ExecutionContext = {
        ...mockContext,
        cloud: { provider: 'aws' },
      };

      const { __mockSend, SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockResolvedValue({
        SecretString: JSON.stringify({ test: 'value' }),
      });

      await awsSecrets.getSecrets(config, contextWithoutRegion);

      expect(SecretsManagerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'eu-west-1',
        })
      );
    });
  });

  describe('Error handling integration', () => {
    it('should validate before fetching secrets', async () => {
      const configWithoutRegion: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          // Missing region
        },
      };

      // Validation should fail when no region is available from config or env
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;
      await expect(awsSecrets.validate(configWithoutRegion)).rejects.toThrow();

      // getSecrets will use default region (us-east-1) if no region is provided
      // This is different from validate() which requires explicit region
      const contextWithoutRegion: ExecutionContext = {
        ...mockContext,
        cloud: { provider: 'aws' }, // No awsRegion
      };

      const { __mockSend, SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockResolvedValue({
        SecretString: JSON.stringify({ test: 'value' }),
      });

      // Should succeed with default region
      await expect(awsSecrets.getSecrets(configWithoutRegion, contextWithoutRegion)).resolves.toBeDefined();
      expect(SecretsManagerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1', // Default region
        })
      );
    });

    it('should handle secret not found error', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'non-existent-secret',
          region: 'us-east-1',
        },
      };

      const { __mockSend, ResourceNotFoundException } =
        require('@aws-sdk/client-secrets-manager');
      __mockSend.mockRejectedValue(new ResourceNotFoundException('Secret not found'));

      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow('not found');
    });

    it('should handle access denied error', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'us-east-1',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-secrets-manager');
      const error = new Error('AccessDenied');
      error.name = 'AccessDeniedException';
      __mockSend.mockRejectedValue(error);

      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow('Access denied');
    });
  });

  describe('TF_VAR conversion convention', () => {
    it('should convert ALL keys to TF_VAR_ prefix regardless of key name', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'us-east-1',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockResolvedValue({
        SecretString: JSON.stringify({
          'special-key': 'value1',
          'key.with.dots': 'value2',
          normalKey: 'value3',
          UPPERCASE_KEY: 'value4',
        }),
      });

      const result = await awsSecrets.getSecrets(config, mockContext);

      // All keys should have TF_VAR_ prefix
      expect(result['TF_VAR_special-key']).toBe('value1');
      expect(result['TF_VAR_key.with.dots']).toBe('value2');
      expect(result.TF_VAR_normalKey).toBe('value3');
      expect(result.TF_VAR_UPPERCASE_KEY).toBe('value4');
    });
  });
});

