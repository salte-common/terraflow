/**
 * Terraform executor
 * Executes terraform commands with proper environment setup
 */

import { spawnSync } from 'child_process';
import type { TerraflowConfig } from '../types/config';
import type { ExecutionContext } from '../types/context';
import { Logger } from '../utils/logger';
import { Validator, FULL_VALIDATION_COMMANDS, BACKEND_REQUIRED_COMMANDS } from './validator';
import { EnvironmentSetup } from './environment';
import { loadAuthPlugin, loadSecretsPlugin, loadBackendPlugin } from './plugin-loader';
import { saveBackendState, detectBackendMigration } from './backend-state';
import { ConfigError } from './errors';

/**
 * Commands that require workspace and init
 * Exported so it can be used by the CLI for command registration
 */
export const WORKSPACE_SENSITIVE_COMMANDS: string[] = ([] as string[]).concat(
  FULL_VALIDATION_COMMANDS,
  BACKEND_REQUIRED_COMMANDS,
  ['init', 'validate'] // terraform init and validate also need backend setup (providers initialized)
);

/**
 * Terraform executor for running terraform commands
 */
export class TerraformExecutor {
  /**
   * Execute full terraform workflow
   * @param command - Terraform command (e.g., 'plan', 'apply', 'destroy')
   * @param args - Additional terraform arguments
   * @param config - Terraflow configuration
   * @param context - Execution context
   * @param options - Execution options
   */
  static async execute(
    command: string,
    args: string[],
    config: TerraflowConfig,
    context: ExecutionContext,
    options: {
      skipCommitCheck?: boolean;
      dryRun?: boolean;
      configFileDir?: string;
    } = {}
  ): Promise<void> {
    // 0. Load .env file early so cloud detection can use credentials from it
    // This needs to happen before validation so AWS credentials are available
    const configFileDir = options.configFileDir || process.cwd();
    EnvironmentSetup.loadEnvFile(configFileDir);

    // Re-detect cloud after .env is loaded (credentials might be in .env)
    const { CloudUtils } = await import('../utils/cloud');
    context.cloud = await CloudUtils.detectCloud(config);

    // 1. Run validations
    Logger.info('🔍 Running validations...');
    const validationResult = await Validator.validate(command, config, context, {
      skipCommitCheck: options.skipCommitCheck || config['skip-commit-check'] || false,
      dryRun: options.dryRun || false,
    });

    if (!validationResult.passed) {
      Logger.error('Validation failed:');
      for (const error of validationResult.errors) {
        Logger.error(`  - ${error}`);
      }
      if (validationResult.warnings.length > 0) {
        Logger.warn('Warnings:');
        for (const warning of validationResult.warnings) {
          Logger.warn(`  - ${warning}`);
        }
      }
      throw new ConfigError('Validation failed');
    }

    if (validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        Logger.warn(warning);
      }
    }
    Logger.info('✅ All validations passed');

    // 2. Setup environment
    Logger.info('🔧 Setting up environment...');
    // .env file already loaded above, pass configFileDir to avoid double-loading
    const { context: updatedContext, resolvedConfig } = await EnvironmentSetup.setup(
      config,
      context,
      configFileDir
    );
    Logger.info('✅ Environment setup complete');

    // 3. Detect backend migration
    if (resolvedConfig.backend) {
      const previousBackendType = detectBackendMigration(
        updatedContext.workingDir,
        resolvedConfig.backend
      );
      if (previousBackendType && previousBackendType !== resolvedConfig.backend.type) {
        Logger.warn(
          `⚠️  Backend changed from '${previousBackendType}' to '${resolvedConfig.backend.type}'. Terraform will prompt to migrate state.`
        );
      }
    }

    // 4. Execute auth plugin (if configured)
    if (
      resolvedConfig.auth?.assume_role ||
      resolvedConfig.auth?.service_principal ||
      resolvedConfig.auth?.service_account
    ) {
      Logger.info('🔐 Authenticating...');
      try {
        let authPlugin;
        if (resolvedConfig.auth.assume_role) {
          authPlugin = await loadAuthPlugin('aws-assume-role');
        } else if (resolvedConfig.auth.service_principal) {
          authPlugin = await loadAuthPlugin('azure-service-principal');
        } else if (resolvedConfig.auth.service_account) {
          authPlugin = await loadAuthPlugin('gcp-service-account');
        }

        if (authPlugin) {
          await authPlugin.validate(resolvedConfig.auth);
          const credentials = await authPlugin.authenticate(resolvedConfig.auth, updatedContext);
          // Set credentials as environment variables
          for (const key in credentials) {
            if (Object.prototype.hasOwnProperty.call(credentials, key)) {
              process.env[key] = credentials[key];
            }
          }
          Logger.info('✅ Authentication successful');

          // If AWS assume role was used, detect account ID from the assumed role credentials
          if (resolvedConfig.auth.assume_role && updatedContext.cloud.provider === 'aws') {
            try {
              const { CloudUtils } = await import('../utils/cloud');
              const accountId = await CloudUtils.getAwsAccountId();
              if (accountId) {
                updatedContext.cloud.awsAccountId = accountId;
                process.env.AWS_ACCOUNT_ID = accountId;
                // Rebuild template variables to include the new account ID
                updatedContext.templateVars = EnvironmentSetup.buildTemplateVars(
                  updatedContext.cloud,
                  updatedContext.vcs,
                  updatedContext.hostname,
                  updatedContext.workspace
                );
                Logger.debug(`Detected AWS account ID from assumed role: ${accountId}`);
              }
            } catch (error) {
              Logger.warn(
                `Failed to detect AWS account ID from assumed role: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }
      } catch (error) {
        Logger.error(
          `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }

    // 5. Execute secrets plugin (if configured)
    if (resolvedConfig.secrets) {
      Logger.info(`🔑 Fetching secrets from ${resolvedConfig.secrets.provider}...`);
      try {
        const secretsPlugin = await loadSecretsPlugin(resolvedConfig.secrets.provider);
        await secretsPlugin.validate(resolvedConfig.secrets);
        const secrets = await secretsPlugin.getSecrets(resolvedConfig.secrets, updatedContext);
        // Set secrets as environment variables (already prefixed with TF_VAR_)
        for (const key in secrets) {
          if (Object.prototype.hasOwnProperty.call(secrets, key)) {
            process.env[key] = secrets[key];
          }
        }
        Logger.info(`✅ Loaded ${Object.keys(secrets).length} Terraform variables from secrets`);
      } catch (error) {
        Logger.error(
          `Failed to fetch secrets: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }

    // 6. Execute backend plugin
    const backendType = resolvedConfig.backend?.type || 'local';
    Logger.debug(`Resolved backend config: ${JSON.stringify(resolvedConfig.backend, null, 2)}`);
    Logger.info(`📦 Configuring ${backendType} backend...`);
    try {
      const backendPlugin = await loadBackendPlugin(backendType);
      await backendPlugin.validate(resolvedConfig.backend || { type: 'local' });

      // Optional setup hook
      if (backendPlugin.setup) {
        await backendPlugin.setup(resolvedConfig.backend || { type: 'local' }, updatedContext);
      }

      const backendArgs = await backendPlugin.getBackendConfig(
        resolvedConfig.backend || { type: 'local' },
        updatedContext
      );

      // Save backend state for migration detection
      if (resolvedConfig.backend) {
        saveBackendState(updatedContext.workingDir, resolvedConfig.backend);
      }

      // Determine if this command needs init and workspace
      const needsInitAndWorkspace = WORKSPACE_SENSITIVE_COMMANDS.includes(command);

      if (options.dryRun) {
        Logger.info('🔍 DRY RUN MODE - Terraform commands will not be executed');
        Logger.info('═══════════════════════════════════════════════════════');
        Logger.info('Would execute:');
        Logger.info('═══════════════════════════════════════════════════════');
        if (needsInitAndWorkspace) {
          Logger.info(`Workspace:        ${updatedContext.workspace}`);
          Logger.info(`Working dir:      ${updatedContext.workingDir}`);
          Logger.info(`Backend:          ${backendType}`);
          if (backendArgs.length > 0) {
            Logger.info('Backend init args:');
            for (const arg of backendArgs) {
              Logger.info(`  ${arg}`);
            }
          }
        }
        Logger.info(`Terraform command: terraform ${command} ${args.join(' ')}`);
        Logger.info('═══════════════════════════════════════════════════════');
      } else {
        if (needsInitAndWorkspace) {
          // 7. Run terraform init with backend config (only for workspace-sensitive commands)
          await TerraformExecutor.init(backendType, backendArgs, updatedContext.workingDir);

          // 8. Select/create workspace (only for workspace-sensitive commands, except terraform init itself)
          if (command !== 'init') {
            await TerraformExecutor.workspace(updatedContext.workspace, updatedContext.workingDir);
          }
        }

        // 9. Execute terraform command
        await TerraformExecutor.runCommand(command, args, updatedContext.workingDir);
      }
    } catch (error) {
      // Check if this is a user cancellation from runCommand
      // runCommand handles cancellation for interactive commands (apply, plan, destroy)
      const exitCode = (error as { status?: number }).status;
      const isInteractiveCommand = ['apply', 'plan', 'destroy'].includes(command);

      if (isInteractiveCommand && exitCode === 1) {
        // User cancellation - runCommand already handled it, just exit
        process.exit(1);
      }

      // For actual errors, log and rethrow
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Backend setup failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Initialize terraform with backend configuration
   * For local backend, runs terraform init without backend-config flags
   * @param backendType - Backend type (e.g., 'local', 's3', 'azurerm', 'gcs')
   * @param backendArgs - Backend configuration arguments (-backend-config flags)
   * @param workingDir - Terraform working directory
   */
  static async init(backendType: string, backendArgs: string[], workingDir: string): Promise<void> {
    const args: string[] = ['init'];

    // For local backend, skip backend-config arguments
    // Terraform uses local backend by default if no backend is configured
    if (backendType !== 'local' && backendArgs.length > 0) {
      args.push(...backendArgs);
    }

    try {
      Logger.debug(`Executing: terraform ${args.join(' ')} in ${workingDir}`);
      // Use spawnSync with array to avoid shell interpretation of special characters
      const result = spawnSync('terraform', args, {
        cwd: workingDir,
        stdio: 'inherit',
        encoding: 'utf8',
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        throw new Error(`Terraform init failed with exit code ${result.status}`);
      }

      Logger.info('✅ Terraform initialized successfully');
    } catch (error) {
      Logger.error(
        `Failed to initialize Terraform: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Select or create workspace
   * @param workspaceName - Workspace name
   * @param workingDir - Terraform working directory
   */
  static async workspace(workspaceName: string, workingDir: string): Promise<void> {
    try {
      // Try to select existing workspace
      Logger.debug(`Selecting workspace: ${workspaceName}`);
      // Use spawnSync with array to avoid shell interpretation
      const selectResult = spawnSync('terraform', ['workspace', 'select', workspaceName], {
        cwd: workingDir,
        stdio: 'pipe',
        encoding: 'utf8',
      });

      if (selectResult.status === 0) {
        Logger.debug(`Workspace ${workspaceName} selected`);
        return;
      }

      // Workspace doesn't exist, create it
      Logger.debug(`Creating workspace: ${workspaceName}`);
      const createResult = spawnSync('terraform', ['workspace', 'new', workspaceName], {
        cwd: workingDir,
        stdio: 'inherit',
        encoding: 'utf8',
      });

      if (createResult.error) {
        throw createResult.error;
      }

      if (createResult.status !== 0) {
        throw new Error(
          `Failed to create workspace: ${createResult.stderr?.toString() || 'Unknown error'}`
        );
      }

      Logger.info(`✅ Workspace ${workspaceName} created and selected`);
    } catch (error) {
      Logger.error(
        `Failed to select/create workspace ${workspaceName}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Execute terraform command
   * @param command - Terraform command (e.g., 'plan', 'apply', 'destroy')
   * @param args - Additional terraform arguments
   * @param workingDir - Terraform working directory
   */
  static async runCommand(command: string, args: string[], workingDir: string): Promise<void> {
    const terraformArgs = [command, ...args];

    try {
      Logger.info(`🚀 Executing: terraform ${terraformArgs.join(' ')}`);
      // Use spawnSync with array to avoid shell interpretation of special characters
      // This ensures arguments with brackets, quotes, etc. are passed correctly to terraform
      const result = spawnSync('terraform', terraformArgs, {
        cwd: workingDir,
        stdio: 'inherit',
        encoding: 'utf8',
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        // Check if this is a user cancellation
        // Terraform exits with code 1 when cancelled and prints "Apply cancelled." etc.
        // Since we use stdio: 'inherit', terraform's message is already shown to the user
        // For interactive commands (apply, plan, destroy), exit code 1 often means cancellation
        const isInteractiveCommand = ['apply', 'plan', 'destroy'].includes(command);

        if (isInteractiveCommand && result.status === 1) {
          // Likely a user cancellation - terraform already printed the message
          // Just exit without adding our own error messages
          process.exit(1);
        }

        // For other errors, throw with status code
        const error = new Error(
          `Terraform command failed with exit code ${result.status ?? 'unknown'}`
        );
        (error as { status?: number }).status = result.status ?? undefined;
        throw error;
      }
    } catch (error) {
      // Check if this is a user cancellation
      const exitCode = (error as { status?: number }).status;
      const isInteractiveCommand = ['apply', 'plan', 'destroy'].includes(command);

      if (isInteractiveCommand && exitCode === 1) {
        // Likely a user cancellation - terraform already printed the message
        // Just exit without adding our own error messages
        process.exit(1);
      }

      // For other errors, log and rethrow
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Terraform command failed: ${errorMessage}`);
      throw error;
    }
  }
}
