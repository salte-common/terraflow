/**
 * Unit tests for AWS Secrets Manager secrets plugin
 */

import { awsSecrets } from '../../src/plugins/secrets/aws-secrets';
import { ConfigError } from '../../src/core/errors';
import type { SecretsConfig, ExecutionContext } from '../../src/types';

// Mock AWS SDK
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

describe('AWS Secrets Manager Plugin', () => {
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
    // Clear environment variables
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
  });

  describe('validate', () => {
    it('should throw ConfigError if config is missing', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
      };

      await expect(awsSecrets.validate(config)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.validate(config)).rejects.toThrow('requires configuration');
    });

    it('should throw ConfigError if secret_name is missing', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          region: 'us-east-1',
        },
      };

      await expect(awsSecrets.validate(config)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.validate(config)).rejects.toThrow('requires "secret_name"');
    });

    it('should throw ConfigError if region is not set', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
        },
      };

      await expect(awsSecrets.validate(config)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.validate(config)).rejects.toThrow('requires "region"');
    });

    it('should succeed with secret_name and region in config', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'us-east-1',
        },
      };

      await expect(awsSecrets.validate(config)).resolves.not.toThrow();
    });

    it('should succeed with secret_name and AWS_REGION env var', async () => {
      process.env.AWS_REGION = 'us-west-2';
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
        },
      };

      await expect(awsSecrets.validate(config)).resolves.not.toThrow();
    });

    it('should succeed with secret_name and AWS_DEFAULT_REGION env var', async () => {
      process.env.AWS_DEFAULT_REGION = 'eu-west-1';
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
        },
      };

      await expect(awsSecrets.validate(config)).resolves.not.toThrow();
    });
  });

  describe('getSecrets', () => {
    it('should fetch secret and convert all keys to TF_VAR_ format', async () => {
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
          environment: 'production',
          instance_count: '3',
          region: 'us-east-1',
        }),
      });

      const result = await awsSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({
        TF_VAR_environment: 'production',
        TF_VAR_instance_count: '3',
        TF_VAR_region: 'us-east-1',
      });

      expect(__mockSend).toHaveBeenCalledTimes(1);
    });

    it('should convert number values to strings', async () => {
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
          count: 5,
          port: 8080,
        }),
      });

      const result = await awsSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({
        TF_VAR_count: '5',
        TF_VAR_port: '8080',
      });
    });

    it('should convert boolean values to strings', async () => {
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
          enabled: true,
          debug: false,
        }),
      });

      const result = await awsSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({
        TF_VAR_enabled: 'true',
        TF_VAR_debug: 'false',
      });
    });

    it('should convert object/array values to JSON strings', async () => {
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
          tags: { env: 'prod', app: 'web' },
          zones: ['us-east-1a', 'us-east-1b'],
        }),
      });

      const result = await awsSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({
        TF_VAR_tags: '{"env":"prod","app":"web"}',
        TF_VAR_zones: '["us-east-1a","us-east-1b"]',
      });
    });

    it('should handle null values', async () => {
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
          null_value: null,
          // Note: undefined values are omitted by JSON.stringify
        }),
      });

      const result = await awsSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({
        TF_VAR_null_value: '',
      });
    });

    it('should use region from context if not in config', async () => {
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

    it('should use region from config over context', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'eu-west-1',
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
          region: 'eu-west-1',
        })
      );
    });

    it('should handle ResourceNotFoundException', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'non-existent-secret',
          region: 'us-east-1',
        },
      };

      const { __mockSend, ResourceNotFoundException } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockRejectedValue(new ResourceNotFoundException('Secret not found'));

      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow('not found');
    });

    it('should handle AccessDeniedException', async () => {
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

      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow('Access denied');
    });

    it('should handle invalid JSON in secret', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'us-east-1',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockResolvedValue({
        SecretString: 'invalid json',
      });

      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow('valid JSON');
    });

    it('should handle missing SecretString', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'us-east-1',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockResolvedValue({
        SecretString: undefined,
      });

      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow(
        'does not contain a string value'
      );
    });

    it('should handle generic AWS errors', async () => {
      const config: SecretsConfig = {
        provider: 'aws-secrets',
        config: {
          secret_name: 'myapp/terraform-vars',
          region: 'us-east-1',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-secrets-manager');
      __mockSend.mockRejectedValue(new Error('Network error'));

      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsSecrets.getSecrets(config, mockContext)).rejects.toThrow(
        'Failed to fetch secret'
      );
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(awsSecrets.name).toBe('aws-secrets');
    });

    it('should implement validate method', () => {
      expect(typeof awsSecrets.validate).toBe('function');
    });

    it('should implement getSecrets method', () => {
      expect(typeof awsSecrets.getSecrets).toBe('function');
    });
  });

  describe('TF_VAR conversion convention', () => {
    it('should convert ALL keys to TF_VAR_ prefix', async () => {
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
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
        }),
      });

      const result = await awsSecrets.getSecrets(config, mockContext);

      // All keys should have TF_VAR_ prefix
      expect(result.TF_VAR_key1).toBe('value1');
      expect(result.TF_VAR_key2).toBe('value2');
      expect(result.TF_VAR_key3).toBe('value3');

      // No keys without prefix
      expect(result.key1).toBeUndefined();
      expect(result.key2).toBeUndefined();
      expect(result.key3).toBeUndefined();
    });
  });
});

