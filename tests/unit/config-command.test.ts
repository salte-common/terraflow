/**
 * Unit tests for ConfigCommand
 */

import { ConfigCommand } from '../../src/commands/config';
import { ConfigManager } from '../../src/core/config';
import { Logger } from '../../src/utils/logger';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Mock Logger
jest.mock('../../src/utils/logger', () => {
  const actualLogger = jest.requireActual('../../src/utils/logger');
  return {
    Logger: {
      ...actualLogger.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      success: jest.fn(),
    },
  };
});

// Mock ConfigManager
jest.mock('../../src/core/config', () => {
  const actualConfig = jest.requireActual('../../src/core/config');
  return {
    ConfigManager: {
      ...actualConfig.ConfigManager,
      load: jest.fn(),
    },
  };
});

describe('ConfigCommand', () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = join(os.tmpdir(), `terraflow-test-${Date.now()}`);
    // Create temp directory (not needed for most tests, but good to have)
  });

  afterEach(() => {
    // Cleanup temp files if needed
    try {
      if (existsSync(join(tempDir, '.tfwconfig.yml'))) {
        unlinkSync(join(tempDir, '.tfwconfig.yml'));
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('show', () => {
    it('should display resolved configuration in YAML format', async () => {
      const mockConfig = {
        workspace: 'test-workspace',
        'working-dir': './terraform',
        backend: {
          type: 'local',
        },
      };

      (ConfigManager.load as jest.Mock).mockResolvedValue(mockConfig);

      await ConfigCommand.show({});

      expect(ConfigManager.load).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalledWith('Resolved configuration:');
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('workspace'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('test-workspace'));
    });

    it('should mask sensitive values', async () => {
      const mockConfig = {
        auth: {
          assume_role: {
            role_arn: 'arn:aws:iam::123456789012:role/test-role',
            session_name: 'test-session',
          },
        },
        secrets: {
          provider: 'aws-secrets',
          config: {
            secret_name: 'test-secret',
            client_secret: 'super-secret-value',
            access_key_id: 'AKIAIOSFODNN7EXAMPLE',
          },
        },
      };

      (ConfigManager.load as jest.Mock).mockResolvedValue(mockConfig);

      await ConfigCommand.show({});

      const infoCalls = (Logger.info as jest.Mock).mock.calls.map((call) => call[0]).join('\n');

      // role_arn should NOT be masked
      expect(infoCalls).toContain('arn:aws:iam::123456789012:role/test-role');

      // Sensitive values should be masked
      expect(infoCalls).toContain('***MASKED***');
      expect(infoCalls).not.toContain('super-secret-value');
      expect(infoCalls).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('should show configuration sources information', async () => {
      (ConfigManager.load as jest.Mock).mockResolvedValue({});

      await ConfigCommand.show({});

      expect(Logger.info).toHaveBeenCalledWith('Configuration sources:');
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('CLI'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('ENV'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('FILE'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('DEFAULT'));
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Config load failed');
      (ConfigManager.load as jest.Mock).mockRejectedValue(error);

      await expect(ConfigCommand.show({})).rejects.toThrow('Config load failed');
      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to show configuration'));
    });

    it('should mask nested sensitive values', async () => {
      const mockConfig = {
        auth: {
          service_principal: {
            client_id: 'test-client-id',
            client_secret: 'secret-value',
          },
        },
      };

      (ConfigManager.load as jest.Mock).mockResolvedValue(mockConfig);

      await ConfigCommand.show({});

      const infoCalls = (Logger.info as jest.Mock).mock.calls.map((call) => call[0]).join('\n');
      expect(infoCalls).toContain('***MASKED***');
      expect(infoCalls).not.toContain('secret-value');
      expect(infoCalls).toContain('test-client-id'); // client_id should not be masked
    });

    it('should handle arrays with sensitive values', async () => {
      const mockConfig = {
        variables: {
          passwords: ['secret1', 'secret2'],
          tokens: ['token1', 'token2'],
        },
      };

      (ConfigManager.load as jest.Mock).mockResolvedValue(mockConfig);

      await ConfigCommand.show({});

      const infoCalls = (Logger.info as jest.Mock).mock.calls.map((call) => call[0]).join('\n');
      expect(infoCalls).toContain('***MASKED***');
    });
  });

  describe('init', () => {
    it('should generate skeleton config file', async () => {
      const outputPath = join(tempDir, '.tfwconfig.yml');

      // Mock existsSync to return false (file doesn't exist)
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);

      await ConfigCommand.init(outputPath);

      expect(existsSync).toHaveBeenCalledWith(outputPath);
      expect(Logger.success).toHaveBeenCalledWith(expect.stringContaining(outputPath));

      // Verify file was created with content
      const fileContent = readFileSync(outputPath, 'utf8');
      expect(fileContent).toContain('Terraflow Configuration File');
      expect(fileContent).toContain('workspace:');
      expect(fileContent).toContain('backend:');
      expect(fileContent).toContain('secrets:');
      expect(fileContent).toContain('auth:');
    });

    it('should use default path if not specified', async () => {
      const defaultPath = join(process.cwd(), '.tfwconfig.yml');

      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);

      await ConfigCommand.init();

      expect(existsSync).toHaveBeenCalledWith(defaultPath);
    });

    it('should fail if file already exists', async () => {
      const outputPath = join(tempDir, '.tfwconfig.yml');

      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);

      await expect(ConfigCommand.init(outputPath)).rejects.toThrow('Configuration file already exists');
      expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('should include examples for all backend types', async () => {
      const outputPath = join(tempDir, '.tfwconfig.yml');
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);

      await ConfigCommand.init(outputPath);

      const fileContent = readFileSync(outputPath, 'utf8');
      expect(fileContent).toContain('S3 Backend Example');
      expect(fileContent).toContain('Azure RM Backend Example');
      expect(fileContent).toContain('GCS Backend Example');
    });

    it('should include examples for all secrets providers', async () => {
      const outputPath = join(tempDir, '.tfwconfig.yml');
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);

      await ConfigCommand.init(outputPath);

      const fileContent = readFileSync(outputPath, 'utf8');
      expect(fileContent).toContain('AWS Secrets Manager');
      expect(fileContent).toContain('Azure Key Vault');
      expect(fileContent).toContain('GCP Secret Manager');
    });

    it('should include examples for all auth configurations', async () => {
      const outputPath = join(tempDir, '.tfwconfig.yml');
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);

      await ConfigCommand.init(outputPath);

      const fileContent = readFileSync(outputPath, 'utf8');
      expect(fileContent).toContain('AWS Assume Role');
      expect(fileContent).toContain('Azure Service Principal');
      expect(fileContent).toContain('GCP Service Account');
    });

    it('should include helpful comments', async () => {
      const outputPath = join(tempDir, '.tfwconfig.yml');
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);

      await ConfigCommand.init(outputPath);

      const fileContent = readFileSync(outputPath, 'utf8');
      expect(fileContent).toContain('Template Variables');
      expect(fileContent).toContain('${VAR}');
      expect(fileContent).toContain('${AWS_REGION}');
      expect(fileContent).toContain('${AWS_ACCOUNT_ID}');
    });

    it('should handle file write errors', async () => {
      const outputPath = join(tempDir, '.tfwconfig.yml');
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
      jest.spyOn(require('fs'), 'writeFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(ConfigCommand.init(outputPath)).rejects.toThrow();
      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create config file'));
    });
  });

  describe('generateConfigSkeleton', () => {
    it('should generate valid YAML structure', () => {
      const skeleton = ConfigCommand.generateConfigSkeleton();

      expect(skeleton).toContain('workspace:');
      expect(skeleton).toContain('working-dir:');
      expect(skeleton).toContain('backend:');
      expect(skeleton).toContain('type: local');
    });

    it('should include all major configuration sections', () => {
      const skeleton = ConfigCommand.generateConfigSkeleton();

      expect(skeleton).toContain('Global Settings');
      expect(skeleton).toContain('Backend Configuration');
      expect(skeleton).toContain('Secrets Management');
      expect(skeleton).toContain('Authentication');
      expect(skeleton).toContain('Terraform Variables');
      expect(skeleton).toContain('Workspace Derivation Strategy');
      expect(skeleton).toContain('Validation Configuration');
      expect(skeleton).toContain('Logging Configuration');
      expect(skeleton).toContain('Template Variables');
    });
  });
});

