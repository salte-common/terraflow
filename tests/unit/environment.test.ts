/**
 * Unit tests for environment setup
 */

import { EnvironmentSetup } from '../../src/core/environment';
import { CloudUtils } from '../../src/utils/cloud';
import type { TerraflowConfig } from '../../src/types/config';
import type { ExecutionContext } from '../../src/types/context';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock dependencies
jest.mock('../../src/utils/cloud');
jest.mock('../../src/utils/git');

describe('EnvironmentSetup', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terraflow-env-test-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TF_VAR_test;
    delete process.env.TF_LOG;
    delete process.env.GIT_BRANCH;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITLAB_PROJECT_PATH;

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadEnvFile', () => {
    it('should load .env file from working directory', () => {
      const envContent = 'TEST_VAR=test-value\nANOTHER_VAR=another-value\n';
      fs.writeFileSync(path.join(tempDir, '.env'), envContent);

      const result = EnvironmentSetup.loadEnvFile(tempDir);

      expect(result).toEqual({
        TEST_VAR: 'test-value',
        ANOTHER_VAR: 'another-value',
      });
      expect(process.env.TEST_VAR).toBe('test-value');
      expect(process.env.ANOTHER_VAR).toBe('another-value');
    });

    it('should return empty object if .env file does not exist', () => {
      const result = EnvironmentSetup.loadEnvFile(tempDir);
      expect(result).toEqual({});
    });

    it('should not override existing environment variables', () => {
      process.env.EXISTING_VAR = 'existing-value';
      const envContent = 'EXISTING_VAR=new-value\nNEW_VAR=new-value\n';
      fs.writeFileSync(path.join(tempDir, '.env'), envContent);

      EnvironmentSetup.loadEnvFile(tempDir);

      expect(process.env.EXISTING_VAR).toBe('existing-value'); // Not overridden
      expect(process.env.NEW_VAR).toBe('new-value'); // New variable set
    });

    it('should handle empty .env file', () => {
      fs.writeFileSync(path.join(tempDir, '.env'), '');
      const result = EnvironmentSetup.loadEnvFile(tempDir);
      expect(result).toEqual({});
    });

    it('should handle malformed .env file gracefully', () => {
      const envContent = 'INVALID_LINE_WITHOUT_EQUALS\nVALID=value\n';
      fs.writeFileSync(path.join(tempDir, '.env'), envContent);

      // Should not throw, just log warning
      expect(() => EnvironmentSetup.loadEnvFile(tempDir)).not.toThrow();
    });
  });

  describe('setupCloud', () => {
    it('should detect and setup cloud provider', async () => {
      const mockCloud: ExecutionContext['cloud'] = {
        provider: 'aws',
        awsAccountId: '123456789012',
        awsRegion: 'us-east-1',
      };
      (CloudUtils.detectCloud as jest.Mock).mockResolvedValue(mockCloud);

      const result = await EnvironmentSetup.setupCloud();

      expect(result).toEqual(mockCloud);
      expect(CloudUtils.detectCloud).toHaveBeenCalled();
    });

    it('should sync AWS region when AWS provider detected', async () => {
      const mockCloud: ExecutionContext['cloud'] = {
        provider: 'aws',
        awsRegion: 'us-west-2',
      };
      (CloudUtils.detectCloud as jest.Mock).mockResolvedValue(mockCloud);
      (CloudUtils.getAwsRegion as jest.Mock).mockReturnValue('us-west-2');

      await EnvironmentSetup.setupCloud();

      expect(CloudUtils.getAwsRegion).toHaveBeenCalled();
    });
  });

  describe('setupVcs', () => {
    it('should set basic git environment variables', async () => {
      const context: ExecutionContext = {
        workspace: 'test',
        workingDir: tempDir,
        cloud: { provider: 'none' },
        vcs: {
          branch: 'main',
          commitSha: 'abc123def456',
          shortSha: 'abc123d',
        },
        hostname: 'test-host',
        env: {},
        templateVars: {},
      };

      await EnvironmentSetup.setupVcs(context);

      expect(process.env.GIT_BRANCH).toBe('main');
      expect(process.env.GIT_COMMIT_SHA).toBe('abc123def456');
      expect(process.env.GIT_SHORT_SHA).toBe('abc123d');
    });

    it('should set GitHub Actions variables when GitHub repository detected', async () => {
      const context: ExecutionContext = {
        workspace: 'test',
        workingDir: tempDir,
        cloud: { provider: 'none' },
        vcs: {
          branch: 'main',
          commitSha: 'abc123def456',
          githubRepository: 'owner/repo',
        },
        hostname: 'test-host',
        env: {},
        templateVars: {},
      };

      await EnvironmentSetup.setupVcs(context);

      expect(process.env.GITHUB_REPOSITORY).toBe('owner/repo');
      expect(process.env.GITHUB_REF).toBe('refs/heads/main');
      expect(process.env.GITHUB_SHA).toBe('abc123def456');
    });

    it('should set GitHub Actions variables for tags', async () => {
      const context: ExecutionContext = {
        workspace: 'test',
        workingDir: tempDir,
        cloud: { provider: 'none' },
        vcs: {
          tag: 'v1.0.0',
          commitSha: 'abc123def456',
          githubRepository: 'owner/repo',
        },
        hostname: 'test-host',
        env: {},
        templateVars: {},
      };

      await EnvironmentSetup.setupVcs(context);

      expect(process.env.GITHUB_REPOSITORY).toBe('owner/repo');
      expect(process.env.GITHUB_REF).toBe('refs/tags/v1.0.0');
      expect(process.env.GITHUB_SHA).toBe('abc123def456');
    });

    it('should set GitLab CI variables when GitLab project detected', async () => {
      const context: ExecutionContext = {
        workspace: 'test',
        workingDir: tempDir,
        cloud: { provider: 'none' },
        vcs: {
          branch: 'main',
          commitSha: 'abc123def456',
          shortSha: 'abc123d',
          gitlabProjectPath: 'group/project',
        },
        hostname: 'test-host',
        env: {},
        templateVars: {},
      };

      await EnvironmentSetup.setupVcs(context);

      expect(process.env.GITLAB_PROJECT_PATH).toBe('group/project');
      expect(process.env.CI_COMMIT_REF_NAME).toBe('main');
      expect(process.env.CI_COMMIT_SHA).toBe('abc123def456');
      expect(process.env.CI_COMMIT_SHORT_SHA).toBe('abc123d');
    });

    it('should calculate short SHA if not provided', async () => {
      const context: ExecutionContext = {
        workspace: 'test',
        workingDir: tempDir,
        cloud: { provider: 'none' },
        vcs: {
          branch: 'main',
          commitSha: 'abcdef1234567890',
        },
        hostname: 'test-host',
        env: {},
        templateVars: {},
      };

      await EnvironmentSetup.setupVcs(context);

      expect(process.env.GIT_SHORT_SHA).toBe('abcdef1');
    });
  });

  describe('setupTerraformVariables', () => {
    it('should convert config variables to TF_VAR_* environment variables', () => {
      const config: TerraflowConfig = {
        variables: {
          environment: 'production',
          instance_count: '3',
          region: 'us-east-1',
        },
      };

      EnvironmentSetup.setupTerraformVariables(config);

      expect(process.env.TF_VAR_environment).toBe('production');
      expect(process.env.TF_VAR_instance_count).toBe('3');
      expect(process.env.TF_VAR_region).toBe('us-east-1');
    });

    it('should convert objects and arrays to JSON strings', () => {
      const config: TerraflowConfig = {
        variables: {
          tags: { env: 'prod', app: 'web' },
          zones: ['us-east-1a', 'us-east-1b'],
        },
      };

      EnvironmentSetup.setupTerraformVariables(config);

      expect(process.env.TF_VAR_tags).toBe('{"env":"prod","app":"web"}');
      expect(process.env.TF_VAR_zones).toBe('["us-east-1a","us-east-1b"]');
    });

    it('should handle null and undefined values', () => {
      const config: TerraflowConfig = {
        variables: {
          null_value: null,
          undefined_value: undefined,
        },
      };

      EnvironmentSetup.setupTerraformVariables(config);

      expect(process.env.TF_VAR_null_value).toBe('');
      expect(process.env.TF_VAR_undefined_value).toBe('');
    });

    it('should not override existing TF_VAR_* environment variables', () => {
      process.env.TF_VAR_existing = 'existing-value';
      const config: TerraflowConfig = {
        variables: {
          existing: 'new-value',
        },
      };

      EnvironmentSetup.setupTerraformVariables(config);

      expect(process.env.TF_VAR_existing).toBe('existing-value'); // Not overridden
    });

    it('should handle config without variables', () => {
      const config: TerraflowConfig = {};
      expect(() => EnvironmentSetup.setupTerraformVariables(config)).not.toThrow();
    });
  });

  describe('setupLogging', () => {
    it('should set TF_LOG when terraform_log_level is configured', () => {
      const config: TerraflowConfig = {
        logging: {
          level: 'info',
          terraform_log_level: 'DEBUG',
        },
      };

      EnvironmentSetup.setupLogging(config);

      expect(process.env.TF_LOG).toBe('DEBUG');
    });

    it('should disable Terraform logging when terraform_log is false', () => {
      process.env.TF_LOG = 'DEBUG';
      const config: TerraflowConfig = {
        logging: {
          level: 'info',
          terraform_log: false,
        },
      };

      EnvironmentSetup.setupLogging(config);

      expect(process.env.TF_LOG).toBeUndefined();
    });

    it('should enable Terraform logging with default level when terraform_log is true', () => {
      const config: TerraflowConfig = {
        logging: {
          level: 'info',
          terraform_log: true,
        },
      };

      EnvironmentSetup.setupLogging(config);

      expect(process.env.TF_LOG).toBe('INFO');
    });

    it('should not override existing TF_LOG when terraform_log is true', () => {
      process.env.TF_LOG = 'TRACE';
      const config: TerraflowConfig = {
        logging: {
          level: 'info',
          terraform_log: true,
        },
      };

      EnvironmentSetup.setupLogging(config);

      expect(process.env.TF_LOG).toBe('TRACE'); // Not overridden
    });

    it('should handle config without logging', () => {
      const config: TerraflowConfig = {};
      expect(() => EnvironmentSetup.setupLogging(config)).not.toThrow();
    });
  });

  describe('resolveTemplateVars', () => {
    it('should resolve template variables in config', () => {
      const config: TerraflowConfig = {
        workspace: '${WORKSPACE}',
        'working-dir': 'terraform/${ENV}',
      };
      const context: ExecutionContext = {
        workspace: 'production',
        workingDir: tempDir,
        cloud: { provider: 'none' },
        vcs: {},
        hostname: 'test-host',
        env: {},
        templateVars: {
          WORKSPACE: 'production',
          ENV: 'prod',
        },
      };

      const result = EnvironmentSetup.resolveTemplateVars(config, context);

      expect(result.workspace).toBe('production');
      expect(result['working-dir']).toBe('terraform/prod');
    });
  });

  describe('setup', () => {
    it('should execute all setup steps in order', async () => {
      const mockCloud: ExecutionContext['cloud'] = {
        provider: 'aws',
        awsRegion: 'us-east-1',
      };
      (CloudUtils.detectCloud as jest.Mock).mockResolvedValue(mockCloud);
      (CloudUtils.getAwsRegion as jest.Mock).mockReturnValue('us-east-1');

      const config: TerraflowConfig = {
        variables: {
          test: 'value',
        },
        logging: {
          level: 'info',
        },
      };

      const context: ExecutionContext = {
        workspace: 'test',
        workingDir: tempDir,
        cloud: { provider: 'none' },
        vcs: {
          branch: 'main',
        },
        hostname: 'test-host',
        env: {},
        templateVars: {},
      };

      const result = await EnvironmentSetup.setup(config, context);

      expect(result.cloud.provider).toBe('aws');
      expect(process.env.TF_VAR_test).toBe('value');
    });
  });
});

