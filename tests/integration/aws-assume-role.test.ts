/**
 * Integration tests for AWS assume role authentication plugin
 * Tests the full authentication flow with mocked AWS SDK
 */

import { awsAssumeRole } from '../../src/plugins/auth/aws-assume-role';
import type { AuthConfig, ExecutionContext } from '../../src/types';

// Mock AWS SDK at the module level
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

describe('AWS Assume Role Authentication - Integration', () => {
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
    const { __mockSend } = require('@aws-sdk/client-sts');
    __mockSend.mockClear();
  });

  describe('Full authentication flow', () => {
    it('should complete full auth flow with default values', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend, AssumeRoleCommand, STSClient } = require('@aws-sdk/client-sts');

      // Mock successful AssumeRole response
      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          SessionToken: 'SESSION_TOKEN_EXAMPLE',
          Expiration: new Date(Date.now() + 3600000), // 1 hour from now
        },
      });

      // Validate first
      await expect(awsAssumeRole.validate(config)).resolves.not.toThrow();

      // Then authenticate
      const credentials = await awsAssumeRole.authenticate(config, mockContext);

      // Verify credentials returned
      expect(credentials).toEqual({
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_SESSION_TOKEN: 'SESSION_TOKEN_EXAMPLE',
      });

      // Verify STS client was created with correct region
      expect(STSClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
        })
      );

      // Verify AssumeRole was called with correct parameters
      expect(AssumeRoleCommand).toHaveBeenCalledWith({
        RoleArn: 'arn:aws:iam::123456789012:role/TerraformRole',
        RoleSessionName: 'terraflow-session', // Default
        DurationSeconds: 3600, // Default
      });

      expect(__mockSend).toHaveBeenCalledTimes(1);
    });

    it('should complete full auth flow with custom values', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::987654321098:role/ProductionRole',
          session_name: 'production-session',
          duration: 7200,
        },
      };

      const contextWithRegion: ExecutionContext = {
        ...mockContext,
        cloud: { provider: 'aws', awsRegion: 'us-west-2' },
      };

      const { __mockSend, AssumeRoleCommand, STSClient } = require('@aws-sdk/client-sts');

      __mockSend.mockResolvedValue({
        Credentials: {
          AccessKeyId: 'AKIAEXAMPLE123',
          SecretAccessKey: 'SECRETKEY123',
          SessionToken: 'TOKEN123',
        },
      });

      // Validate
      await expect(awsAssumeRole.validate(config)).resolves.not.toThrow();

      // Authenticate
      const credentials = await awsAssumeRole.authenticate(config, contextWithRegion);

      // Verify credentials
      expect(credentials).toEqual({
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE123',
        AWS_SECRET_ACCESS_KEY: 'SECRETKEY123',
        AWS_SESSION_TOKEN: 'TOKEN123',
      });

      // Verify custom region was used
      expect(STSClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-west-2',
        })
      );

      // Verify custom parameters were used
      expect(AssumeRoleCommand).toHaveBeenCalledWith({
        RoleArn: 'arn:aws:iam::987654321098:role/ProductionRole',
        RoleSessionName: 'production-session',
        DurationSeconds: 7200,
      });
    });

    it('should handle authentication failure gracefully', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-sts');

      // Mock AccessDenied error
      const error = new Error('User is not authorized to perform: sts:AssumeRole');
      error.name = 'AccessDenied';
      __mockSend.mockRejectedValue(error);

      // Validation should pass
      await expect(awsAssumeRole.validate(config)).resolves.not.toThrow();

      // Authentication should fail with helpful error
      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(
        'Access denied when assuming role'
      );
    });
  });

  describe('Error handling integration', () => {
    it('should validate before authenticating', async () => {
      const invalidConfig: AuthConfig = {
        assume_role: {
          role_arn: 'invalid-arn',
        },
      };

      // Validation should fail
      await expect(awsAssumeRole.validate(invalidConfig)).rejects.toThrow();

      // Authentication should also fail (validation happens first)
      await expect(awsAssumeRole.authenticate(invalidConfig, mockContext)).rejects.toThrow();
    });

    it('should handle network errors during authentication', async () => {
      const config: AuthConfig = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
        },
      };

      const { __mockSend } = require('@aws-sdk/client-sts');
      __mockSend.mockRejectedValue(new Error('Network timeout'));

      await expect(awsAssumeRole.authenticate(config, mockContext)).rejects.toThrow(
        'Failed to assume role'
      );
    });
  });
});

