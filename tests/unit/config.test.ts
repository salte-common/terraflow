/**
 * Unit tests for configuration manager
 */

import { ConfigManager } from '../../src/core/config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { TerraflowConfig } from '../../src/types/config';

describe('ConfigManager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terraflow-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // Clean up environment variables
    delete process.env.TERRAFLOW_WORKSPACE;
    delete process.env.TERRAFLOW_WORKING_DIR;
    delete process.env.TERRAFLOW_BACKEND;
    delete process.env.TERRAFLOW_SECRETS;
    delete process.env.TERRAFLOW_SKIP_COMMIT_CHECK;
    delete process.env.TERRAFLOW_ASSUME_ROLE;
  });

  describe('load', () => {
    it('should return default configuration when no config exists', async () => {
      const config = await ConfigManager.load({}, tempDir);

      expect(config.backend?.type).toBe('local');
      expect(config['working-dir']).toBe('./terraform');
      expect(config['skip-commit-check']).toBe(false);
      expect(config.logging?.level).toBe('info');
    });

    it('should load configuration from file', async () => {
      const configFile = path.join(tempDir, '.tfwconfig.yml');
      const yamlContent = `
workspace: test-workspace
working-dir: ./test-terraform
skip-commit-check: true
backend:
  type: s3
  config:
    bucket: my-bucket
`;
      fs.writeFileSync(configFile, yamlContent, 'utf8');

      const config = await ConfigManager.load({}, tempDir);

      expect(config.workspace).toBe('test-workspace');
      expect(config['working-dir']).toBe('./test-terraform');
      expect(config['skip-commit-check']).toBe(true);
      expect(config.backend?.type).toBe('s3');
    });

    it('should load configuration from custom path via CLI option', async () => {
      const customConfigPath = path.join(tempDir, 'custom-config.yml');
      const yamlContent = 'workspace: custom-workspace\n';
      fs.writeFileSync(customConfigPath, yamlContent, 'utf8');

      const config = await ConfigManager.load({ config: customConfigPath }, tempDir);

      expect(config.workspace).toBe('custom-workspace');
    });

    it('should load configuration from environment variables', async () => {
      process.env.TERRAFLOW_WORKSPACE = 'env-workspace';
      process.env.TERRAFLOW_WORKING_DIR = './env-terraform';
      process.env.TERRAFLOW_BACKEND = 's3';
      process.env.TERRAFLOW_SKIP_COMMIT_CHECK = 'true';

      const config = await ConfigManager.load({}, tempDir);

      expect(config.workspace).toBe('env-workspace');
      expect(config['working-dir']).toBe('./env-terraform');
      expect(config.backend?.type).toBe('s3');
      expect(config['skip-commit-check']).toBe(true);
    });

    it('should prioritize CLI options over environment variables', async () => {
      process.env.TERRAFLOW_WORKSPACE = 'env-workspace';
      process.env.TERRAFLOW_BACKEND = 's3';

      const config = await ConfigManager.load(
        {
          workspace: 'cli-workspace',
          backend: 'azurerm',
        },
        tempDir
      );

      expect(config.workspace).toBe('cli-workspace');
      expect(config.backend?.type).toBe('azurerm');
    });

    it('should prioritize CLI options over config file', async () => {
      const configFile = path.join(tempDir, '.tfwconfig.yml');
      fs.writeFileSync(
        configFile,
        'workspace: file-workspace\nbackend:\n  type: s3\n',
        'utf8'
      );

      const config = await ConfigManager.load(
        {
          workspace: 'cli-workspace',
          backend: 'gcs',
        },
        tempDir
      );

      expect(config.workspace).toBe('cli-workspace');
      expect(config.backend?.type).toBe('gcs');
    });

    it('should merge nested objects correctly', async () => {
      const configFile = path.join(tempDir, '.tfwconfig.yml');
      fs.writeFileSync(
        configFile,
        `backend:
  type: s3
  config:
    bucket: file-bucket
    region: us-east-1
`,
        'utf8'
      );

      const config = await ConfigManager.load({}, tempDir);

      expect(config.backend?.type).toBe('s3');
      expect((config.backend?.config as Record<string, unknown>)?.bucket).toBe('file-bucket');
      expect((config.backend?.config as Record<string, unknown>)?.region).toBe('us-east-1');
    });

    it('should handle boolean environment variables correctly', async () => {
      process.env.TERRAFLOW_SKIP_COMMIT_CHECK = 'true';
      let config = await ConfigManager.load({}, tempDir);
      expect(config['skip-commit-check']).toBe(true);

      process.env.TERRAFLOW_SKIP_COMMIT_CHECK = '1';
      config = await ConfigManager.load({}, tempDir);
      expect(config['skip-commit-check']).toBe(true);

      process.env.TERRAFLOW_SKIP_COMMIT_CHECK = 'yes';
      config = await ConfigManager.load({}, tempDir);
      expect(config['skip-commit-check']).toBe(true);

      process.env.TERRAFLOW_SKIP_COMMIT_CHECK = 'false';
      config = await ConfigManager.load({}, tempDir);
      expect(config['skip-commit-check']).toBe(false);
    });

    it('should set log level from CLI verbose option', async () => {
      const config = await ConfigManager.load({ verbose: true }, tempDir);
      expect(config.logging?.level).toBe('info');
    });

    it('should set log level from CLI debug option', async () => {
      const config = await ConfigManager.load({ debug: true }, tempDir);
      expect(config.logging?.level).toBe('debug');
    });

    it('should handle assume role from CLI', async () => {
      const config = await ConfigManager.load(
        {
          assumeRole: 'arn:aws:iam::123456789:role/TestRole',
        },
        tempDir
      );

      expect(config.auth?.assume_role?.role_arn).toBe('arn:aws:iam::123456789:role/TestRole');
    });

    it('should handle assume role from environment', async () => {
      process.env.TERRAFLOW_ASSUME_ROLE = 'arn:aws:iam::987654321:role/EnvRole';

      const config = await ConfigManager.load({}, tempDir);

      expect(config.auth?.assume_role?.role_arn).toBe('arn:aws:iam::987654321:role/EnvRole');
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace from config', () => {
      const config: TerraflowConfig = { workspace: 'test-workspace' };
      expect(ConfigManager.getWorkspace(config)).toBe('test-workspace');
    });

    it('should return undefined when workspace not set', () => {
      const config: TerraflowConfig = {};
      expect(ConfigManager.getWorkspace(config)).toBeUndefined();
    });
  });

  describe('getWorkingDir', () => {
    it('should return absolute path when working-dir is absolute', () => {
      const config: TerraflowConfig = { 'working-dir': '/absolute/path' };
      const result = ConfigManager.getWorkingDir(config, tempDir);
      expect(result).toBe('/absolute/path');
    });

    it('should return relative path resolved against cwd', () => {
      const config: TerraflowConfig = { 'working-dir': './relative/path' };
      const result = ConfigManager.getWorkingDir(config, tempDir);
      expect(result).toBe(path.join(tempDir, './relative/path'));
    });

    it('should use default when working-dir not set', () => {
      const config: TerraflowConfig = {};
      const result = ConfigManager.getWorkingDir(config, tempDir);
      expect(result).toBe(path.join(tempDir, './terraform'));
    });
  });
});

