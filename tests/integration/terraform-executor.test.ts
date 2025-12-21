/**
 * Integration tests for Terraform executor
 * Tests the full execution flow including validations, environment setup,
 * plugin execution, and terraform commands
 */

import { TerraformExecutor } from '../../src/core/terraform';
import { ConfigManager } from '../../src/core/config';
import { ContextBuilder } from '../../src/core/context';
import { Logger } from '../../src/utils/logger';
import * as child_process from 'child_process';

// Mock child_process
jest.mock('child_process');
const mockExecSync = child_process.execSync as jest.MockedFunction<typeof child_process.execSync>;

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => {
  const actualLogger = jest.requireActual('../../src/utils/logger');
  return {
    Logger: {
      ...actualLogger.Logger,
      setLevel: jest.fn(),
      setColor: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      success: jest.fn(),
    },
  };
});

// Mock environment setup
jest.mock('../../src/core/environment', () => {
  return {
    EnvironmentSetup: {
      setup: jest.fn(async (_config, context) => {
        return context;
      }),
    },
  };
});

// Mock plugin loaders
jest.mock('../../src/core/plugin-loader', () => {
  const mockBackendPlugin = {
    name: 'local',
    validate: jest.fn(async () => {}),
    getBackendConfig: jest.fn(async () => []),
  };

  const mockSecretsPlugin = {
    name: 'env',
    validate: jest.fn(async () => {}),
    getSecrets: jest.fn(async () => ({})),
  };

  const mockAuthPlugin = {
    name: 'aws-assume-role',
    validate: jest.fn(async () => {}),
    authenticate: jest.fn(async () => ({
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      AWS_SESSION_TOKEN: 'test-token',
    })),
  };

  return {
    loadBackendPlugin: jest.fn(async (name: string) => {
      if (name === 'local') return mockBackendPlugin;
      if (name === 's3') return mockBackendPlugin;
      throw new Error(`Unknown backend plugin: ${name}`);
    }),
    loadSecretsPlugin: jest.fn(async (name: string) => {
      if (name === 'env') return mockSecretsPlugin;
      throw new Error(`Unknown secrets plugin: ${name}`);
    }),
    loadAuthPlugin: jest.fn(async (name: string) => {
      if (name === 'aws-assume-role') return mockAuthPlugin;
      throw new Error(`Unknown auth plugin: ${name}`);
    }),
  };
});

// Mock backend state
jest.mock('../../src/core/backend-state', () => {
  return {
    detectBackendMigration: jest.fn(() => null),
    saveBackendState: jest.fn(),
  };
});

// Mock validator
jest.mock('../../src/core/validator', () => {
  return {
    Validator: {
      validate: jest.fn(async () => ({
        passed: true,
        errors: [],
        warnings: [],
      })),
    },
  };
});

describe('TerraformExecutor - Integration', () => {
  const mockWorkingDir = '/tmp/test-terraform';

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecSync.mockImplementation(() => Buffer.from(''));
    Logger.setLevel('error');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Full execution flow', () => {
    it('should execute full flow with local backend', async () => {
      const config = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await TerraformExecutor.execute('plan', [], config, context, {});

      // Verify terraform init was called
      expect(mockExecSync).toHaveBeenCalledWith(
        'terraform init',
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'inherit',
        })
      );

      // Verify workspace select was attempted
      expect(mockExecSync).toHaveBeenCalledWith(
        'terraform workspace select test-workspace',
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'pipe',
        })
      );

      // Verify terraform command was executed
      expect(mockExecSync).toHaveBeenCalledWith(
        'terraform plan',
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'inherit',
        })
      );
    });

    it('should execute full flow with auth plugin', async () => {
      const config = await ConfigManager.load({});
      config.auth = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/test-role',
        },
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      const { loadAuthPlugin } = require('../../src/core/plugin-loader');
      const mockAuthPlugin = await loadAuthPlugin('aws-assume-role');

      await TerraformExecutor.execute('plan', [], config, context, {});

      // Verify auth plugin was called
      expect(mockAuthPlugin.validate).toHaveBeenCalled();
      expect(mockAuthPlugin.authenticate).toHaveBeenCalled();

      // Verify credentials were set in environment
      expect(process.env.AWS_ACCESS_KEY_ID).toBe('test-key');
      expect(process.env.AWS_SECRET_ACCESS_KEY).toBe('test-secret');
      expect(process.env.AWS_SESSION_TOKEN).toBe('test-token');
    });

    it('should execute full flow with secrets plugin', async () => {
      const config = await ConfigManager.load({});
      config.secrets = {
        provider: 'env',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      const { loadSecretsPlugin } = require('../../src/core/plugin-loader');
      const mockSecretsPlugin = await loadSecretsPlugin('env');

      await TerraformExecutor.execute('plan', [], config, context, {});

      // Verify secrets plugin was called
      expect(mockSecretsPlugin.validate).toHaveBeenCalled();
      expect(mockSecretsPlugin.getSecrets).toHaveBeenCalled();
    });

    it('should execute plugins in correct order: auth -> secrets -> backend', async () => {
      const config = await ConfigManager.load({});
      config.auth = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/test-role',
        },
      };
      config.secrets = {
        provider: 'env',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      const { loadAuthPlugin, loadSecretsPlugin, loadBackendPlugin } =
        require('../../src/core/plugin-loader');
      const mockAuthPlugin = await loadAuthPlugin('aws-assume-role');
      const mockSecretsPlugin = await loadSecretsPlugin('env');
      const mockBackendPlugin = await loadBackendPlugin('local');

      const authValidateSpy = jest.spyOn(mockAuthPlugin, 'validate');
      const secretsValidateSpy = jest.spyOn(mockSecretsPlugin, 'validate');
      const backendValidateSpy = jest.spyOn(mockBackendPlugin, 'validate');

      await TerraformExecutor.execute('plan', [], config, context, {});

      // Verify order: auth -> secrets -> backend
      const authCallIndex = authValidateSpy.mock.invocationCallOrder[0];
      const secretsCallIndex = secretsValidateSpy.mock.invocationCallOrder[0];
      const backendCallIndex = backendValidateSpy.mock.invocationCallOrder[0];

      expect(authCallIndex).toBeLessThan(secretsCallIndex);
      expect(secretsCallIndex).toBeLessThan(backendCallIndex);
    });

    it('should create workspace if it does not exist', async () => {
      const config = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'new-workspace';

      // Mock workspace select to fail (workspace doesn't exist)
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('workspace select')) {
          throw new Error('workspace does not exist');
        }
        if (command.includes('workspace new')) {
          return Buffer.from('');
        }
        return Buffer.from('');
      });

      await TerraformExecutor.execute('plan', [], config, context, {});

      // Verify workspace select was attempted
      expect(mockExecSync).toHaveBeenCalledWith(
        'terraform workspace select new-workspace',
        expect.anything()
      );

      // Verify workspace new was called
      expect(mockExecSync).toHaveBeenCalledWith(
        'terraform workspace new new-workspace',
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'inherit',
        })
      );
    });

    it('should handle workspace creation failure', async () => {
      const config = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'new-workspace';

      // Mock both workspace select and new to fail
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('workspace')) {
          throw new Error('workspace operation failed');
        }
        return Buffer.from('');
      });

      await expect(
        TerraformExecutor.execute('plan', [], config, context, {})
      ).rejects.toThrow();
    });
  });

  describe('Dry-run mode', () => {
    it('should run all validations and plugins but not execute terraform commands', async () => {
      const config = await ConfigManager.load({});
      config.auth = {
        assume_role: {
          role_arn: 'arn:aws:iam::123456789012:role/test-role',
        },
      };
      config.secrets = {
        provider: 'env',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      const { loadAuthPlugin, loadSecretsPlugin, loadBackendPlugin } =
        require('../../src/core/plugin-loader');
      const mockAuthPlugin = await loadAuthPlugin('aws-assume-role');
      const mockSecretsPlugin = await loadSecretsPlugin('env');
      const mockBackendPlugin = await loadBackendPlugin('local');

      await TerraformExecutor.execute('plan', ['-var', 'test=value'], config, context, {
        dryRun: true,
      });

      // Verify validations ran
      const { Validator } = require('../../src/core/validator');
      expect(Validator.validate).toHaveBeenCalled();

      // Verify plugins were executed
      expect(mockAuthPlugin.validate).toHaveBeenCalled();
      expect(mockSecretsPlugin.validate).toHaveBeenCalled();
      expect(mockBackendPlugin.validate).toHaveBeenCalled();

      // Verify terraform commands were NOT executed
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('terraform init'),
        expect.anything()
      );
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('terraform plan'),
        expect.anything()
      );

      // Verify dry-run info was logged
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE'));
    });

    it('should display what would be executed in dry-run mode', async () => {
      const config = await ConfigManager.load({});
      config.backend = {
        type: 's3',
        config: {
          bucket: 'test-bucket',
          key: 'test-key',
        },
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await TerraformExecutor.execute('apply', ['-auto-approve'], config, context, {
        dryRun: true,
      });

      // Verify dry-run output includes workspace, working dir, backend, and command
      const infoCalls = (Logger.info as jest.Mock).mock.calls.map((call) => call[0]).join('\n');
      expect(infoCalls).toContain('test-workspace');
      expect(infoCalls).toContain(mockWorkingDir);
      expect(infoCalls).toContain('s3');
      expect(infoCalls).toContain('terraform apply');
    });
  });

  describe('Error handling', () => {
    it('should fail if validation fails', async () => {
      const { Validator } = require('../../src/core/validator');
      Validator.validate.mockResolvedValueOnce({
        passed: false,
        errors: ['Terraform not installed'],
        warnings: [],
      });

      const config = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, {})
      ).rejects.toThrow('Validation failed');
    });

    it('should fail if auth plugin fails', async () => {
      const { loadAuthPlugin } = require('../../src/core/plugin-loader');
      const mockAuthPlugin = await loadAuthPlugin('aws-assume-role');
      mockAuthPlugin.validate.mockRejectedValueOnce(new Error('Invalid role ARN'));

      const config = await ConfigManager.load({});
      config.auth = {
        assume_role: {
          role_arn: 'invalid-arn',
        },
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, {})
      ).rejects.toThrow('Invalid role ARN');
    });

    it('should fail if secrets plugin fails', async () => {
      const { loadSecretsPlugin } = require('../../src/core/plugin-loader');
      const mockSecretsPlugin = await loadSecretsPlugin('env');
      mockSecretsPlugin.getSecrets.mockRejectedValueOnce(new Error('Secret not found'));

      const config = await ConfigManager.load({});
      config.secrets = {
        provider: 'env',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, {})
      ).rejects.toThrow('Secret not found');
    });

    it('should fail if backend plugin fails', async () => {
      const { loadBackendPlugin } = require('../../src/core/plugin-loader');
      const mockBackendPlugin = await loadBackendPlugin('local');
      mockBackendPlugin.validate.mockRejectedValueOnce(new Error('Invalid backend config'));

      const config = await ConfigManager.load({});
      config.backend = {
        type: 'local',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, {})
      ).rejects.toThrow('Invalid backend config');
    });

    it('should fail if terraform init fails', async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('terraform init')) {
          throw new Error('Init failed');
        }
        return Buffer.from('');
      });

      const config = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, {})
      ).rejects.toThrow();
    });

    it('should fail if terraform command fails', async () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('terraform plan')) {
          throw new Error('Plan failed');
        }
        return Buffer.from('');
      });

      const config = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, {})
      ).rejects.toThrow();
    });
  });

  describe('Backend configuration', () => {
    it('should skip backend-config args for local backend', async () => {
      const config = await ConfigManager.load({});
      config.backend = {
        type: 'local',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await TerraformExecutor.execute('plan', [], config, context, {});

      // Verify init was called without backend-config flags
      expect(mockExecSync).toHaveBeenCalledWith(
        'terraform init',
        expect.anything()
      );

      // Verify it was NOT called with -backend-config
      const initCalls = mockExecSync.mock.calls.filter((call) =>
        call[0].toString().includes('terraform init')
      );
      expect(initCalls[0][0]).not.toContain('-backend-config');
    });

    it('should include backend-config args for remote backends', async () => {
      const config = await ConfigManager.load({});
      config.backend = {
        type: 's3',
        config: {
          bucket: 'test-bucket',
          key: 'test-key',
        },
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      const { loadBackendPlugin } = require('../../src/core/plugin-loader');
      const mockBackendPlugin = await loadBackendPlugin('s3');
      mockBackendPlugin.getBackendConfig.mockResolvedValueOnce([
        '-backend-config=bucket=test-bucket',
        '-backend-config=key=test-key',
      ]);

      await TerraformExecutor.execute('plan', [], config, context, {});

      // Verify backend plugin's getBackendConfig was called
      expect(mockBackendPlugin.getBackendConfig).toHaveBeenCalled();
    });
  });
});

