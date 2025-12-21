/**
 * Unit tests for S3 backend plugin
 */

import { s3Backend } from '../../src/plugins/backends/s3';
import { ConfigError } from '../../src/core/errors';
import type { BackendConfig, ExecutionContext } from '../../src/types';

describe('S3 Backend Plugin', () => {
  const mockContext: ExecutionContext = {
    workspace: 'test',
    workingDir: '/tmp/test',
    cloud: { provider: 'aws', awsRegion: 'us-east-1', awsAccountId: '123456789012' },
    vcs: {},
    hostname: 'test-host',
    env: {},
    templateVars: {
      AWS_REGION: 'us-east-1',
      AWS_ACCOUNT_ID: '123456789012',
      GITHUB_REPOSITORY: 'owner/repo',
    },
  };

  describe('validate', () => {
    it('should throw ConfigError if config is missing', async () => {
      const config: BackendConfig = {
        type: 's3',
      };

      await expect(s3Backend.validate(config)).rejects.toThrow(ConfigError);
      await expect(s3Backend.validate(config)).rejects.toThrow('requires configuration');
    });

    it('should throw ConfigError if bucket is missing', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          key: 'terraform.tfstate',
        },
      };

      await expect(s3Backend.validate(config)).rejects.toThrow(ConfigError);
      await expect(s3Backend.validate(config)).rejects.toThrow('requires "bucket"');
    });

    it('should throw ConfigError if key is missing', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
        },
      };

      await expect(s3Backend.validate(config)).rejects.toThrow(ConfigError);
      await expect(s3Backend.validate(config)).rejects.toThrow('requires "key"');
    });

    it('should succeed with bucket and key', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      await expect(s3Backend.validate(config)).resolves.not.toThrow();
    });

    it('should warn if encrypt is false', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          encrypt: false,
        },
      };

      const warnSpy = jest.spyOn(require('../../src/utils/logger').Logger, 'warn');
      warnSpy.mockClear();

      await s3Backend.validate(config);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('encryption is disabled')
      );

      warnSpy.mockRestore();
    });

    it('should not warn if encrypt is true', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          encrypt: true,
        },
      };

      const warnSpy = jest.spyOn(require('../../src/utils/logger').Logger, 'warn');
      warnSpy.mockClear();

      await s3Backend.validate(config);

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('getBackendConfig', () => {
    it('should return backend-config args for required fields', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain('-backend-config=bucket=my-bucket');
      expect(result).toContain('-backend-config=key=terraform.tfstate');
      expect(result).toContain('-backend-config=encrypt=true'); // Default
      expect(result).toContain('-backend-config=dynamodb_table=terraform-statelock'); // Default
    });

    it('should apply default values', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain('-backend-config=encrypt=true');
      expect(result).toContain('-backend-config=dynamodb_table=terraform-statelock');
    });

    it('should include optional fields when provided', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-west-2',
          encrypt: false,
          dynamodb_table: 'my-lock-table',
          kms_key_id: 'arn:aws:kms:us-west-2:123456789012:key/abc123',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain('-backend-config=region=us-west-2');
      expect(result).toContain('-backend-config=encrypt=false');
      expect(result).toContain('-backend-config=dynamodb_table=my-lock-table');
      expect(result).toContain(
        '-backend-config=kms_key_id=arn:aws:kms:us-west-2:123456789012:key/abc123'
      );
    });

    it('should resolve template variables in config', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: '${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state',
          key: '${GITHUB_REPOSITORY}/terraform.tfstate',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain('-backend-config=bucket=us-east-1-123456789012-terraform-state');
      expect(result).toContain('-backend-config=key=owner/repo/terraform.tfstate');
    });

    it('should include AWS credential options when provided', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          profile: 'my-profile',
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
          session_name: 'terraform-session',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain('-backend-config=profile=my-profile');
      expect(result).toContain(
        '-backend-config=role_arn=arn:aws:iam::123456789012:role/TerraformRole'
      );
      expect(result).toContain('-backend-config=session_name=terraform-session');
    });

    it('should throw ConfigError if config is missing', async () => {
      const config: BackendConfig = {
        type: 's3',
      };

      await expect(s3Backend.getBackendConfig(config, mockContext)).rejects.toThrow(
        ConfigError
      );
    });
  });

  describe('setup', () => {
    it('should be defined as optional method', () => {
      expect(s3Backend.setup).toBeDefined();
      expect(typeof s3Backend.setup).toBe('function');
    });

    it('should handle missing bucket gracefully', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          key: 'terraform.tfstate',
        },
      };

      // Should not throw, validation will catch this
      await expect(s3Backend.setup?.(config, mockContext)).resolves.not.toThrow();
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(s3Backend.name).toBe('s3');
    });

    it('should implement validate method', () => {
      expect(typeof s3Backend.validate).toBe('function');
    });

    it('should implement getBackendConfig method', () => {
      expect(typeof s3Backend.getBackendConfig).toBe('function');
    });
  });
});

