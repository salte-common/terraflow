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
const mockSpawnSync = child_process.spawnSync as jest.MockedFunction<typeof child_process.spawnSync>;

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
  const actualEnv = jest.requireActual('../../src/core/environment');
  return {
    EnvironmentSetup: {
      ...actualEnv.EnvironmentSetup,
      setup: jest.fn(async (_config, context) => {
        return { context, resolvedConfig: _config };
      }),
      loadEnvFile: jest.fn(() => ({})), // Mock loadEnvFile to return empty object
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
    FULL_VALIDATION_COMMANDS: ['apply', 'destroy', 'import', 'refresh'],
    BACKEND_REQUIRED_COMMANDS: ['plan', 'state', 'workspace', 'output', 'show'],
  };
});

// Mock ContextBuilder to avoid git command execution
jest.mock('../../src/core/context', () => {
  return {
    ContextBuilder: {
      build: jest.fn(async (_config, _cwd) => ({
        workspace: 'test-workspace',
        workingDir: '/tmp/test-terraform',
        cloud: { provider: 'none' },
        vcs: {},
        hostname: 'test-host',
        env: {},
        templateVars: {},
      })),
    },
  };
});

describe('TerraformExecutor - Integration', () => {
  const mockWorkingDir = '/tmp/test-terraform';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpawnSync.mockImplementation(() => ({
      status: 0,
      signal: null,
      output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      pid: 12345,
      error: undefined,
    }));
    Logger.setLevel('error');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Full execution flow', () => {
    it('should execute full flow with local backend', async () => {
      const { config } = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Verify terraform init was called
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'terraform',
        ['init'],
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'inherit',
        })
      );

      // Verify workspace select was attempted
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'terraform',
        ['workspace', 'select', 'test-workspace'],
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'pipe',
        })
      );

      // Verify terraform command was executed
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'terraform',
        ['plan'],
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'inherit',
        })
      );
    });

    it('should execute full flow with auth plugin', async () => {
      const { config } = await ConfigManager.load({});
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

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Verify auth plugin was called
      expect(mockAuthPlugin.validate).toHaveBeenCalled();
      expect(mockAuthPlugin.authenticate).toHaveBeenCalled();

      // Verify credentials were set in environment
      expect(process.env.AWS_ACCESS_KEY_ID).toBe('test-key');
      expect(process.env.AWS_SECRET_ACCESS_KEY).toBe('test-secret');
      expect(process.env.AWS_SESSION_TOKEN).toBe('test-token');
    });

    it('should execute full flow with secrets plugin', async () => {
      const { config } = await ConfigManager.load({});
      config.secrets = {
        provider: 'env',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      const { loadSecretsPlugin } = require('../../src/core/plugin-loader');
      const mockSecretsPlugin = await loadSecretsPlugin('env');

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Verify secrets plugin was called
      expect(mockSecretsPlugin.validate).toHaveBeenCalled();
      expect(mockSecretsPlugin.getSecrets).toHaveBeenCalled();
    });

    it('should execute plugins in correct order: auth -> secrets -> backend', async () => {
      const { config } = await ConfigManager.load({});
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

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Verify order: auth -> secrets -> backend
      const authCallIndex = authValidateSpy.mock.invocationCallOrder[0];
      const secretsCallIndex = secretsValidateSpy.mock.invocationCallOrder[0];
      const backendCallIndex = backendValidateSpy.mock.invocationCallOrder[0];

      expect(authCallIndex).toBeLessThan(secretsCallIndex);
      expect(secretsCallIndex).toBeLessThan(backendCallIndex);
    });

    it('should create workspace if it does not exist', async () => {
      const { config } = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'new-workspace';

      // Mock workspace select to fail (workspace doesn't exist)
      mockSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        if (command === 'terraform' && args && args[0] === 'workspace' && args[1] === 'select') {
          return {
            status: 1,
            signal: null,
            output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
            stdout: Buffer.from(''),
            stderr: Buffer.from('workspace does not exist'),
            pid: 12345,
            error: undefined,
          };
        }
        if (command === 'terraform' && args && args[0] === 'workspace' && args[1] === 'new') {
          return {
            status: 0,
            signal: null,
            output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
            stdout: Buffer.from(''),
            stderr: Buffer.from(''),
            pid: 12345,
            error: undefined,
          };
        }
        return {
          status: 0,
          signal: null,
          output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 12345,
          error: undefined,
        };
      });

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Verify workspace select was attempted
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'terraform',
        ['workspace', 'select', 'new-workspace'],
        expect.anything()
      );

      // Verify workspace new was called
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'terraform',
        ['workspace', 'new', 'new-workspace'],
        expect.objectContaining({
          cwd: mockWorkingDir,
          stdio: 'inherit',
        })
      );
    });

    it('should handle workspace creation failure', async () => {
      const { config } = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'new-workspace';

      // Mock both workspace select and new to fail
      mockSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        if (command === 'terraform' && args && args[0] === 'workspace') {
          return {
            status: 1,
            signal: null,
            output: [Buffer.from(''), Buffer.from(''), Buffer.from('workspace operation failed')],
            stdout: Buffer.from(''),
            stderr: Buffer.from('workspace operation failed'),
            pid: 12345,
            error: new Error('workspace operation failed'),
          };
        }
        return {
          status: 0,
          signal: null,
          output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 12345,
          error: undefined,
        };
      });

      await expect(
        TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() })
      ).rejects.toThrow();
    });
  });

  describe('Dry-run mode', () => {
    it('should run all validations and plugins but not execute terraform commands', async () => {
      const { config } = await ConfigManager.load({});
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
        configFileDir: process.cwd(),
      });

      // Verify validations ran
      const { Validator } = require('../../src/core/validator');
      expect(Validator.validate).toHaveBeenCalled();

      // Verify plugins were executed
      expect(mockAuthPlugin.validate).toHaveBeenCalled();
      expect(mockSecretsPlugin.validate).toHaveBeenCalled();
      expect(mockBackendPlugin.validate).toHaveBeenCalled();

      // Verify terraform commands were NOT executed
      expect(mockSpawnSync).not.toHaveBeenCalledWith(
        'terraform',
        ['init'],
        expect.anything()
      );
      expect(mockSpawnSync).not.toHaveBeenCalledWith(
        'terraform',
        ['plan'],
        expect.anything()
      );

      // Verify dry-run info was logged
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE'));
    });

    it('should display what would be executed in dry-run mode', async () => {
      const { config } = await ConfigManager.load({});
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
        configFileDir: process.cwd(),
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

      const { config } = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() })
      ).rejects.toThrow('Validation failed');
    });

    it('should fail if auth plugin fails', async () => {
      const { loadAuthPlugin } = require('../../src/core/plugin-loader');
      const mockAuthPlugin = await loadAuthPlugin('aws-assume-role');
      mockAuthPlugin.validate.mockRejectedValueOnce(new Error('Invalid role ARN'));

      const { config } = await ConfigManager.load({});
      config.auth = {
        assume_role: {
          role_arn: 'invalid-arn',
        },
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() })
      ).rejects.toThrow('Invalid role ARN');
    });

    it('should fail if secrets plugin fails', async () => {
      const { loadSecretsPlugin } = require('../../src/core/plugin-loader');
      const mockSecretsPlugin = await loadSecretsPlugin('env');
      mockSecretsPlugin.getSecrets.mockRejectedValueOnce(new Error('Secret not found'));

      const { config } = await ConfigManager.load({});
      config.secrets = {
        provider: 'env',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() })
      ).rejects.toThrow('Secret not found');
    });

    it('should fail if backend plugin fails', async () => {
      const { loadBackendPlugin } = require('../../src/core/plugin-loader');
      const mockBackendPlugin = await loadBackendPlugin('local');
      mockBackendPlugin.validate.mockRejectedValueOnce(new Error('Invalid backend config'));

      const { config } = await ConfigManager.load({});
      config.backend = {
        type: 'local',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() })
      ).rejects.toThrow('Invalid backend config');
    });

    it('should fail if terraform init fails', async () => {
      mockSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        if (command === 'terraform' && args && args[0] === 'init') {
          return {
            status: 1,
            signal: null,
            output: [Buffer.from(''), Buffer.from(''), Buffer.from('Init failed')],
            stdout: Buffer.from(''),
            stderr: Buffer.from('Init failed'),
            pid: 12345,
            error: new Error('Init failed'),
          };
        }
        return {
          status: 0,
          signal: null,
          output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 12345,
          error: undefined,
        };
      });

      const { config } = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() })
      ).rejects.toThrow();
    });

    it('should fail if terraform command fails', async () => {
      mockSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        if (command === 'terraform' && args && args[0] === 'plan') {
          return {
            status: 1,
            signal: null,
            output: [Buffer.from(''), Buffer.from(''), Buffer.from('Plan failed')],
            stdout: Buffer.from(''),
            stderr: Buffer.from('Plan failed'),
            pid: 12345,
            error: new Error('Plan failed'),
          };
        }
        return {
          status: 0,
          signal: null,
          output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 12345,
          error: undefined,
        };
      });

      const { config } = await ConfigManager.load({});
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await expect(
        TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() })
      ).rejects.toThrow();
    });
  });

  describe('Backend configuration', () => {
    it('should skip backend-config args for local backend', async () => {
      const { config } = await ConfigManager.load({});
      config.backend = {
        type: 'local',
        config: {},
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Verify init was called without backend-config flags
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'terraform',
        ['init'],
        expect.anything()
      );

      // Verify it was NOT called with -backend-config
      const initCalls = mockSpawnSync.mock.calls.filter(
        (call) => call[0] === 'terraform' && call[1]?.[0] === 'init'
      );
      expect(initCalls[0][1]).not.toContain('-backend-config');
    });

    it('should include backend-config args for remote backends', async () => {
      const { config } = await ConfigManager.load({});
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

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Verify backend plugin's getBackendConfig was called
      expect(mockBackendPlugin.getBackendConfig).toHaveBeenCalled();
    });
  });

  describe('Command arguments handling', () => {
    it('should pass arguments with special characters correctly without shell interpretation', async () => {
      const { config } = await ConfigManager.load({});
      // Ensure provider is set (required field)
      if (!config.provider) {
        config.provider = 'aws';
      }
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      // Track all spawnSync calls to verify arguments
      const spawnCalls: Array<{ command: string; args: readonly string[] }> = [];
      mockSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        spawnCalls.push({ command, args: args || [] });
        return {
          status: 0,
          signal: null,
          output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 12345,
          error: undefined,
        };
      });

      // Test arguments with various special characters that could be interpreted by shell
      const specialArgs = [
        '-var',
        'tags={key="value",env="prod"}', // JSON-like object with brackets and quotes
        '-var',
        'list=[item1,item2,item3]', // Array with brackets
        '-var',
        'path=/path/to/file[0].txt', // Path with brackets
        '-var',
        'value="string with spaces"', // Quoted string with spaces
        '-var',
        'special=value&other=thing', // Ampersand
        '-var',
        'nested={outer={inner="value"}}', // Nested brackets
      ];

      await TerraformExecutor.execute('plan', specialArgs, config, context, {
        configFileDir: process.cwd(),
      });

      // Find the plan command call (there will also be init and workspace calls)
      const planCall = spawnCalls.find(
        (call) => call.command === 'terraform' && call.args && call.args[0] === 'plan'
      );

      expect(planCall).toBeDefined();
      expect(planCall?.args).toBeDefined();
      // Verify plan is the first arg and specialArgs follow
      expect(planCall?.args[0]).toBe('plan');
      expect(planCall?.args.slice(1)).toEqual(specialArgs);

      // Verify that special characters are preserved exactly as passed
      // (not interpreted by shell)
      expect(planCall?.args).toContain('tags={key="value",env="prod"}');
      expect(planCall?.args).toContain('list=[item1,item2,item3]');
      expect(planCall?.args).toContain('path=/path/to/file[0].txt');
      expect(planCall?.args).toContain('value="string with spaces"');
      expect(planCall?.args).toContain('special=value&other=thing');
      expect(planCall?.args).toContain('nested={outer={inner="value"}}');
    });

    it('should handle backend-config arguments with special characters', async () => {
      const { config } = await ConfigManager.load({});
      // Ensure provider is set (required field)
      if (!config.provider) {
        config.provider = 'aws';
      }
      config.backend = {
        type: 's3',
        config: {
          bucket: 'test-bucket',
          key: 'path/to/state[env].tfstate', // Key with brackets
        },
      };
      const context = await ContextBuilder.build(config);
      context.workingDir = mockWorkingDir;
      context.workspace = 'test-workspace';

      const { loadBackendPlugin } = require('../../src/core/plugin-loader');
      const mockBackendPlugin = await loadBackendPlugin('s3');
      mockBackendPlugin.getBackendConfig.mockResolvedValueOnce([
        '-backend-config=bucket=test-bucket',
        '-backend-config=key=path/to/state[env].tfstate', // Special characters in backend config
        '-backend-config=tags={env="prod",app="web"}', // JSON-like value
      ]);

      const spawnCalls: Array<{ command: string; args: readonly string[] }> = [];
      mockSpawnSync.mockImplementation((command: string, args?: readonly string[]) => {
        spawnCalls.push({ command, args: args || [] });
        return {
          status: 0,
          signal: null,
          output: [Buffer.from(''), Buffer.from(''), Buffer.from('')],
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 12345,
          error: undefined,
        };
      });

      await TerraformExecutor.execute('plan', [], config, context, { configFileDir: process.cwd() });

      // Find the init command call
      const initCall = spawnCalls.find(
        (call) => call.command === 'terraform' && call.args[0] === 'init'
      );

      expect(initCall).toBeDefined();
      // Verify backend-config arguments with special characters are passed correctly
      expect(initCall?.args).toContain('-backend-config=key=path/to/state[env].tfstate');
      expect(initCall?.args).toContain('-backend-config=tags={env="prod",app="web"}');
    });
  });
});

