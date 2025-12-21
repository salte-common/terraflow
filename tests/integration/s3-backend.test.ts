/**
 * Integration tests for S3 backend plugin with mocked AWS SDK
 */

import { s3Backend } from '../../src/plugins/backends/s3';
import type { BackendConfig, ExecutionContext } from '../../src/types';
import { execSync } from 'child_process';

// Mock child_process execSync
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('S3 Backend Plugin - Integration', () => {
  const mockContext: ExecutionContext = {
    workspace: 'test',
    workingDir: '/tmp/test',
    cloud: { provider: 'aws', awsRegion: 'us-east-1', awsAccountId: '123456789012' },
    vcs: {
      branch: 'main',
      githubRepository: 'owner/repo',
    },
    hostname: 'test-host',
    env: {},
    templateVars: {
      AWS_REGION: 'us-east-1',
      AWS_ACCOUNT_ID: '123456789012',
      GITHUB_REPOSITORY: 'owner/repo',
      GIT_BRANCH: 'main',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBackendConfig with template variables', () => {
    it('should resolve template variables from context', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: '${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state',
          key: '${GITHUB_REPOSITORY}/terraform.tfstate',
          region: '${AWS_REGION}',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain('-backend-config=bucket=us-east-1-123456789012-terraform-state');
      expect(result).toContain('-backend-config=key=owner/repo/terraform.tfstate');
      expect(result).toContain('-backend-config=region=us-east-1');
    });

    it('should generate backend config with defaults', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-terraform-state',
          key: 'terraform.tfstate',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain('-backend-config=bucket=my-terraform-state');
      expect(result).toContain('-backend-config=key=terraform.tfstate');
      expect(result).toContain('-backend-config=encrypt=true');
      expect(result).toContain('-backend-config=dynamodb_table=terraform-statelock');
    });

    it('should generate KMS key ARN format from template variables', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          kms_key_id: 'arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:alias/terraform-state',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      expect(result).toContain(
        '-backend-config=kms_key_id=arn:aws:kms:us-east-1:123456789012:alias/terraform-state'
      );
    });
  });

  describe('setup with mocked AWS CLI', () => {
    it('should verify bucket exists using AWS CLI', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-terraform-state',
          key: 'terraform.tfstate',
        },
      };

      // Mock successful bucket check
      (execSync as jest.Mock).mockReturnValue('');

      await s3Backend.setup?.(config, mockContext);

      expect(execSync).toHaveBeenCalledWith(
        'aws s3api head-bucket --bucket my-terraform-state',
        expect.objectContaining({
          stdio: 'pipe',
          encoding: 'utf8',
        })
      );
    });

    it('should handle bucket check failure gracefully', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'non-existent-bucket',
          key: 'terraform.tfstate',
        },
      };

      // Mock bucket check failure
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Bucket does not exist');
      });

      // Should not throw
      await expect(s3Backend.setup?.(config, mockContext)).resolves.not.toThrow();

      expect(execSync).toHaveBeenCalled();
    });

    it('should handle missing bucket gracefully', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          key: 'terraform.tfstate',
        },
      };

      // Should not throw or call AWS CLI
      await expect(s3Backend.setup?.(config, mockContext)).resolves.not.toThrow();

      // AWS CLI should not be called if bucket is missing
      expect(execSync).not.toHaveBeenCalled();
    });
  });

  describe('complete S3 backend configuration', () => {
    it('should generate complete backend config with all options', async () => {
      const config: BackendConfig = {
        type: 's3',
        config: {
          bucket: '${AWS_REGION}-${AWS_ACCOUNT_ID}-terraform-state',
          key: '${GITHUB_REPOSITORY}/${GIT_BRANCH}/terraform.tfstate',
          region: '${AWS_REGION}',
          encrypt: true,
          dynamodb_table: 'terraform-statelock',
          kms_key_id: 'arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:alias/terraform-state',
          profile: 'terraform',
        },
      };

      const result = await s3Backend.getBackendConfig(config, mockContext);

      // Required fields
      expect(result).toContain(
        '-backend-config=bucket=us-east-1-123456789012-terraform-state'
      );
      expect(result).toContain('-backend-config=key=owner/repo/main/terraform.tfstate');

      // Optional fields
      expect(result).toContain('-backend-config=region=us-east-1');
      expect(result).toContain('-backend-config=encrypt=true');
      expect(result).toContain('-backend-config=dynamodb_table=terraform-statelock');
      expect(result).toContain(
        '-backend-config=kms_key_id=arn:aws:kms:us-east-1:123456789012:alias/terraform-state'
      );
      expect(result).toContain('-backend-config=profile=terraform');
    });
  });
});

