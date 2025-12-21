/**
 * Terraform executor
 * Executes terraform commands with proper environment setup
 */

import { execSync } from 'child_process';
import type { TerraflowConfig } from '../types/config';
import type { ExecutionContext } from '../types/context';
import { Logger } from '../utils/logger';
import { Validator } from './validator';
import { EnvironmentSetup } from './environment';
import { loadAuthPlugin, loadSecretsPlugin, loadBackendPlugin } from './plugin-loader';
import { saveBackendState, detectBackendMigration } from './backend-state';
import { ConfigError } from './errors';

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
    } = {}
  ): Promise<void> {
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
    const updatedContext = await EnvironmentSetup.setup(config, context);
    Logger.info('✅ Environment setup complete');

    // 3. Detect backend migration
    if (config.backend) {
      const previousBackendType = detectBackendMigration(updatedContext.workingDir, config.backend);
      if (previousBackendType && previousBackendType !== config.backend.type) {
        Logger.warn(
          `⚠️  Backend changed from '${previousBackendType}' to '${config.backend.type}'. Terraform will prompt to migrate state.`
        );
      }
    }

    // 4. Execute auth plugin (if configured)
    if (
      config.auth?.assume_role ||
      config.auth?.service_principal ||
      config.auth?.service_account
    ) {
      Logger.info('🔐 Authenticating...');
      try {
        let authPlugin;
        if (config.auth.assume_role) {
          authPlugin = await loadAuthPlugin('aws-assume-role');
        } else if (config.auth.service_principal) {
          authPlugin = await loadAuthPlugin('azure-service-principal');
        } else if (config.auth.service_account) {
          authPlugin = await loadAuthPlugin('gcp-service-account');
        }

        if (authPlugin) {
          await authPlugin.validate(config.auth);
          const credentials = await authPlugin.authenticate(config.auth, updatedContext);
          // Set credentials as environment variables
          for (const key in credentials) {
            if (Object.prototype.hasOwnProperty.call(credentials, key)) {
              process.env[key] = credentials[key];
            }
          }
          Logger.info('✅ Authentication successful');
        }
      } catch (error) {
        Logger.error(
          `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }

    // 5. Execute secrets plugin (if configured)
    if (config.secrets) {
      Logger.info(`🔑 Fetching secrets from ${config.secrets.provider}...`);
      try {
        const secretsPlugin = await loadSecretsPlugin(config.secrets.provider);
        await secretsPlugin.validate(config.secrets);
        const secrets = await secretsPlugin.getSecrets(config.secrets, updatedContext);
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
    const backendType = config.backend?.type || 'local';
    Logger.info(`📦 Configuring ${backendType} backend...`);
    try {
      const backendPlugin = await loadBackendPlugin(backendType);
      await backendPlugin.validate(config.backend || { type: 'local' });

      // Optional setup hook
      if (backendPlugin.setup) {
        await backendPlugin.setup(config.backend || { type: 'local' }, updatedContext);
      }

      const backendArgs = await backendPlugin.getBackendConfig(
        config.backend || { type: 'local' },
        updatedContext
      );

      // Save backend state for migration detection
      if (config.backend) {
        saveBackendState(updatedContext.workingDir, config.backend);
      }

      if (options.dryRun) {
        Logger.info('🔍 DRY RUN MODE - Terraform commands will not be executed');
        Logger.info('═══════════════════════════════════════════════════════');
        Logger.info('Would execute:');
        Logger.info('═══════════════════════════════════════════════════════');
        Logger.info(`Workspace:        ${updatedContext.workspace}`);
        Logger.info(`Working dir:      ${updatedContext.workingDir}`);
        Logger.info(`Backend:          ${backendType}`);
        if (backendArgs.length > 0) {
          Logger.info('Backend init args:');
          for (const arg of backendArgs) {
            Logger.info(`  ${arg}`);
          }
        }
        Logger.info(`Terraform command: terraform ${command} ${args.join(' ')}`);
        Logger.info('═══════════════════════════════════════════════════════');
      } else {
        // 7. Run terraform init with backend config
        await TerraformExecutor.init(backendType, backendArgs, updatedContext.workingDir);

        // 8. Select/create workspace
        await TerraformExecutor.workspace(updatedContext.workspace, updatedContext.workingDir);

        // 9. Execute terraform command
        await TerraformExecutor.runCommand(command, args, updatedContext.workingDir);
      }
    } catch (error) {
      Logger.error(
        `Backend setup failed: ${error instanceof Error ? error.message : String(error)}`
      );
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
      execSync(`terraform ${args.join(' ')}`, {
        cwd: workingDir,
        stdio: 'inherit',
        encoding: 'utf8',
      });
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
      execSync(`terraform workspace select ${workspaceName}`, {
        cwd: workingDir,
        stdio: 'pipe',
        encoding: 'utf8',
      });
      Logger.debug(`Workspace ${workspaceName} selected`);
    } catch {
      // Workspace doesn't exist, create it
      try {
        Logger.debug(`Creating workspace: ${workspaceName}`);
        execSync(`terraform workspace new ${workspaceName}`, {
          cwd: workingDir,
          stdio: 'inherit',
          encoding: 'utf8',
        });
        Logger.info(`✅ Workspace ${workspaceName} created and selected`);
      } catch (error) {
        Logger.error(
          `Failed to create workspace ${workspaceName}: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
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
      execSync(`terraform ${terraformArgs.join(' ')}`, {
        cwd: workingDir,
        stdio: 'inherit',
        encoding: 'utf8',
      });
    } catch (error) {
      Logger.error(
        `Terraform command failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
