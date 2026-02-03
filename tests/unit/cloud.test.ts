/**
 * Unit tests for CloudUtils
 */

import { execSync } from 'child_process';
import { CloudUtils } from '../../src/utils/cloud';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.Mock;

describe('CloudUtils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('detectCloud', () => {
    it('should return provider none when no config or env', async () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_PROFILE;
      delete process.env.AWS_REGION;
      delete process.env.AZURE_CLIENT_ID;
      delete process.env.ARM_CLIENT_ID;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.GCLOUD_PROJECT;

      const result = await CloudUtils.detectCloud();
      expect(result.provider).toBe('none');
    });

    it('should use config.provider aws and set region and account', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ Account: '123456789012' }));

      const result = await CloudUtils.detectCloud({ provider: 'aws' });

      expect(result.provider).toBe('aws');
      expect(result.awsRegion).toBeDefined();
      expect(result.awsAccountId).toBe('123456789012');
    });

    it('should use config.provider aws and continue without account on sts failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('STS failed');
      });

      const result = await CloudUtils.detectCloud({ provider: 'aws' });

      expect(result.provider).toBe('aws');
      expect(result.awsAccountId).toBeUndefined();
    });

    it('should use config.provider azure and set subscription and tenant', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify({ id: 'sub-123', tenantId: 'tenant-456' })
      );

      const result = await CloudUtils.detectCloud({ provider: 'azure' });

      expect(result.provider).toBe('azure');
      expect(result.azureSubscriptionId).toBe('sub-123');
      expect(result.azureTenantId).toBe('tenant-456');
    });

    it('should use config.provider azure and continue without ids on failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('az failed');
      });

      const result = await CloudUtils.detectCloud({ provider: 'azure' });

      expect(result.provider).toBe('azure');
      expect(result.azureSubscriptionId).toBeUndefined();
      expect(result.azureTenantId).toBeUndefined();
    });

    it('should use config.provider gcp and set project', async () => {
      mockExecSync.mockReturnValue('my-gcp-project\n');

      const result = await CloudUtils.detectCloud({ provider: 'gcp' });

      expect(result.provider).toBe('gcp');
      expect(result.gcpProjectId).toBe('my-gcp-project');
    });

    it('should use config.provider gcp and continue without project on failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('gcloud failed');
      });

      const result = await CloudUtils.detectCloud({ provider: 'gcp' });

      expect(result.provider).toBe('gcp');
      expect(result.gcpProjectId).toBeUndefined();
    });

    it('should fallback to aws when AWS_ACCESS_KEY_ID is set', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAXXX';
      mockExecSync.mockReturnValue(JSON.stringify({ Account: '111111111111' }));

      const result = await CloudUtils.detectCloud();

      expect(result.provider).toBe('aws');
      expect(result.awsAccountId).toBe('111111111111');
    });

    it('should fallback to aws when AWS_PROFILE is set', async () => {
      process.env.AWS_PROFILE = 'myprofile';
      mockExecSync.mockReturnValue(JSON.stringify({ Account: '222222222222' }));

      const result = await CloudUtils.detectCloud();

      expect(result.provider).toBe('aws');
    });

    it('should fallback to aws when AWS_REGION is set', async () => {
      process.env.AWS_REGION = 'us-west-2';
      mockExecSync.mockReturnValue(JSON.stringify({ Account: '333333333333' }));

      const result = await CloudUtils.detectCloud();

      expect(result.provider).toBe('aws');
    });

    it('should fallback to azure when AZURE_CLIENT_ID is set', async () => {
      process.env.AZURE_CLIENT_ID = 'client-id';
      mockExecSync.mockReturnValue(
        JSON.stringify({ id: 'sub-1', tenantId: 'tenant-1' })
      );

      const result = await CloudUtils.detectCloud();

      expect(result.provider).toBe('azure');
      expect(result.azureSubscriptionId).toBe('sub-1');
      expect(result.azureTenantId).toBe('tenant-1');
    });

    it('should fallback to azure when ARM_CLIENT_ID is set', async () => {
      process.env.ARM_CLIENT_ID = 'arm-client';
      mockExecSync.mockReturnValue(
        JSON.stringify({ id: 'sub-2', tenantId: 'tenant-2' })
      );

      const result = await CloudUtils.detectCloud();

      expect(result.provider).toBe('azure');
    });

    it('should fallback to gcp when GOOGLE_APPLICATION_CREDENTIALS is set', async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/key.json';
      mockExecSync.mockReturnValue('gcp-project-id\n');

      const result = await CloudUtils.detectCloud();

      expect(result.provider).toBe('gcp');
      expect(result.gcpProjectId).toBe('gcp-project-id');
    });

    it('should fallback to gcp when GCLOUD_PROJECT is set', async () => {
      process.env.GCLOUD_PROJECT = 'env-project';
      mockExecSync.mockReturnValue('env-project\n');

      const result = await CloudUtils.detectCloud();

      expect(result.provider).toBe('gcp');
    });
  });

  describe('getAwsRegion', () => {
    it('should return AWS_REGION when set', () => {
      process.env.AWS_REGION = 'eu-west-1';
      delete process.env.AWS_DEFAULT_REGION;

      const region = CloudUtils.getAwsRegion();

      expect(region).toBe('eu-west-1');
      expect(process.env.AWS_DEFAULT_REGION).toBe('eu-west-1');
    });

    it('should return AWS_DEFAULT_REGION when set and sync to AWS_REGION', () => {
      process.env.AWS_DEFAULT_REGION = 'ap-southeast-1';
      delete process.env.AWS_REGION;

      const region = CloudUtils.getAwsRegion();

      expect(region).toBe('ap-southeast-1');
      expect(process.env.AWS_REGION).toBe('ap-southeast-1');
    });

    it('should default to us-east-1 when neither region is set', () => {
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;

      const region = CloudUtils.getAwsRegion();

      expect(region).toBe('us-east-1');
      expect(process.env.AWS_REGION).toBe('us-east-1');
      expect(process.env.AWS_DEFAULT_REGION).toBe('us-east-1');
    });
  });

  describe('getAwsAccountId', () => {
    it('should return account id from sts get-caller-identity', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ Account: '999888777666' }));

      const id = await CloudUtils.getAwsAccountId();

      expect(id).toBe('999888777666');
      expect(mockExecSync).toHaveBeenCalledWith(
        'aws sts get-caller-identity --output json',
        expect.any(Object)
      );
    });

    it('should return undefined when sts fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not authenticated');
      });

      const id = await CloudUtils.getAwsAccountId();

      expect(id).toBeUndefined();
    });
  });

  describe('getAzureSubscriptionId', () => {
    it('should return subscription id from az account show', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ id: 'sub-abc-123' }));

      const id = await CloudUtils.getAzureSubscriptionId();

      expect(id).toBe('sub-abc-123');
    });

    it('should return undefined when az fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('az not found');
      });

      const id = await CloudUtils.getAzureSubscriptionId();

      expect(id).toBeUndefined();
    });
  });

  describe('getAzureTenantId', () => {
    it('should return tenant id from az account show', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ tenantId: 'tenant-xyz' }));

      const id = await CloudUtils.getAzureTenantId();

      expect(id).toBe('tenant-xyz');
    });

    it('should return undefined when az fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('az failed');
      });

      const id = await CloudUtils.getAzureTenantId();

      expect(id).toBeUndefined();
    });
  });

  describe('getGcpProjectId', () => {
    it('should return project id from gcloud config', async () => {
      mockExecSync.mockReturnValue(' my-project \n');

      const id = await CloudUtils.getGcpProjectId();

      expect(id).toBe('my-project');
    });

    it('should return undefined when result is empty after trim', async () => {
      mockExecSync.mockReturnValue('   \n');

      const id = await CloudUtils.getGcpProjectId();

      expect(id).toBeUndefined();
    });

    it('should return undefined when gcloud fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('gcloud not found');
      });

      const id = await CloudUtils.getGcpProjectId();

      expect(id).toBeUndefined();
    });
  });
});
