/**
 * Unit tests for AWS assume role authentication plugin
 */

import { awsAssumeRole } from '../../src/plugins/auth/aws-assume-role';
import { ConfigError } from '../../src/core/errors';
import type { AuthConfig, ExecutionContext } from '../../src/types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sts', () => {
  const mockSend = jest.fn();
  return {
    STSClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    AssumeRoleCommand: jest.fn().mockImplementation((params) => params),
    __mockSend: mockSend,
  };
});

describe('AWS Assume Role Authentication Plugin', () => {
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
    // Get the mock send function
    const { __mockSend } = require('@aws-sdk/client-sts');
    __mockSend.mockClear();
  });

  describe('validate', () => {
    it('should throw ConfigError if assume_role config is missing', async () => {
      const config: AuthConfig = {};

      await expect(awsAssumeRole.validate(config)).rejects.toThrow(ConfigError);
      await expect(awsAssumeRole.validate(config)).rejects.toThrow('AWS assume role configuration is required');
    });

    it('should throw ConfigError if role_arn is missing', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: '',
        },
      };

      await expect(awsAssumeRole.validate(config)).rejects.toThrow(ConfigError);
      await expect(awsAssumeRole.validate(config)).rejects.toThrow('requires "role_arn"');
    });

    it('should throw ConfigError if role_arn format is invalid', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'invalid-arn',
        },
      };

      await expect(awsAssumeRole.validate(config)).rejects.toThrow(ConfigError);
      await expect(awsAssumeRole.validate(config)).rejects.toThrow('Invalid role_arn format');
    });

    it('should throw ConfigError if role_arn has invalid account ID', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::12345:role/MyRole',
        },
      };

      await expect(awsAssumeRole.validate(config)).rejects.toThrow(ConfigError);
    });

    it('should succeed with valid role_arn', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      await expect(awsAssumeRole.validate(config)).resolves.not.toThrow();
    });

    it('should throw ConfigError if duration is too short', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
          duration: 500, // Less than 900 seconds (15 minutes)
        },
      };

      await expect(awsAssumeRole.validate(config)).rejects.toThrow(ConfigError);
      await expect(awsAssumeRole.validate(config)).rejects.toThrow('Invalid duration');
    });

    it('should throw ConfigError if duration is too long', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
          duration: 50000, // More than 43200 seconds (12 hours)
        },
      };

      await expect(awsAssumeRole.validate(config)).rejects.toThrow(ConfigError);
    });

    it('should succeed with valid duration', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
          duration: 3600,
        },
      };

      await expect(awsAssumeRole.validate(config)).resolves.not.toThrow();
    });
  });

  describe('authenticate', () => {
    it('should return credentials as environment variables', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-sts');
      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          SessionToken: 'SESSION_TOKEN_EXAMPLE',
          Expiration: new Date('2024-12-21T12:00:00Z'),
        },
      });

      const result = await awsAssumeRole.authenticate(config, mockContext);

      expect(result).toEqual({
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_SESSION_TOKEN: 'SESSION_TOKEN_EXAMPLE',
      });

      expect(__mockSend).toHaveBeenCalledTimes(1);
    });

    it('should use default session_name if not provided', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend, AssumeRoleCommand } = require('@aws-sdk/client-sts');
      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          SessionToken: 'SESSION_TOKEN_EXAMPLE',
        },
      });

      await awsAssumeRole.authenticate(config, mockContext);

      expect(AssumeRoleCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          RoleSessionName: 'terraflow-session',
        })
      );
    });

    it('should use custom session_name if provided', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
          session_name: 'my-custom-session',
        },
      };

      const { __mockSend, AssumeRoleCommand } = require('@aws-sdk/client-sts');
      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          SessionToken: 'SESSION_TOKEN_EXAMPLE',
        },
      });

      await awsAssumeRole.authenticate(config, mockContext);

      expect(AssumeRoleCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          RoleSessionName: 'my-custom-session',
        })
      );
    });

    it('should use default duration if not provided', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend, AssumeRoleCommand } = require('@aws-sdk/client-sts');
      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          SessionToken: 'SESSION_TOKEN_EXAMPLE',
        },
      });

      await awsAssumeRole.authenticate(config, mockContext);

      expect(AssumeRoleCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          DurationSeconds: 3600,
        })
      );
    });

    it('should use custom duration if provided', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
          duration: 7200,
        },
      };

      const { __mockSend, AssumeRoleCommand } = require('@aws-sdk/client-sts');
      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          SessionToken: 'SESSION_TOKEN_EXAMPLE',
        },
      });

      await awsAssumeRole.authenticate(config, mockContext);

      expect(AssumeRoleCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          DurationSeconds: 7200,
        })
      );
    });

    it('should throw ConfigError if credentials are missing from response', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-sts');
      __mockSend.mockResolvedValue({
        Credentials: undefined,
      });

      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(
        'AssumeRole response did not contain credentials'
      );
    });

    it('should handle AccessDenied error', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-sts');
      const error = new Error('AccessDenied');
      error.name = 'AccessDenied';
      __mockSend.mockRejectedValue(error);

      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(
        'Access denied when assuming role'
      );
    });

    it('should handle NoSuchEntity error', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/NonExistentRole',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-sts');
      __mockSend.mockRejectedValue(new Error('NoSuchEntity'));

      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(
        'does not exist'
      );
    });

    it('should handle generic AWS errors', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-sts');
      __mockSend.mockRejectedValue(new Error('Network error'));

      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(ConfigError);
      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(
        'Failed to assume role'
      );
    });

    it('should use region from context if available', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const contextWithRegion: ExecutionContext = {
        ...mockContext,
        cloud: { provider: 'aws', awsRegion: 'us-west-2' },
      };

      const { __mockSend, STSClient } = require('@aws-sdk/client-sts');
      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          SessionToken: 'SESSION_TOKEN_EXAMPLE',
        },
      });

      await awsAssumeRole.authenticate(config, contextWithRegion);

      expect(STSClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-west-2',
        })
      );
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(awsAssumeRole.name).toBe('aws-assume-role');
    });

    it('should implement validate method', () => {
      expect(typeof awsAssumeRole.validate).toBe('function');
    });

    it('should implement authenticate method', () => {
      expect(typeof awsAssumeRole.authenticate).toBe('function');
    });
  });
});

