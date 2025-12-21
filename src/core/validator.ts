/**
 * Validation engine
 * Validates configuration, workspace, and environment
 */

import { execSync } from 'child_process';
import type { TerraflowConfig, ValidationConfig } from '../types/config';
import type { ExecutionContext } from '../types/context';
import { GitUtils } from '../utils/git';
import { ValidationError } from './errors';
import { Logger } from '../utils/logger';

/**
 * Command categories for validation
 */
export const FULL_VALIDATION_COMMANDS = ['apply', 'destroy', 'import', 'refresh'];
export const BACKEND_REQUIRED_COMMANDS = ['plan', 'state', 'workspace', 'output', 'show'];
export const MINIMAL_VALIDATION_COMMANDS = ['fmt', 'validate', 'version', 'providers'];

/**
 * Validation result
 */
export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validation engine for Terraflow
 */
export class Validator {
  /**
   * Validate terraform is installed and accessible
   * @throws {ValidationError} If terraform is not installed
   */
  static async validateTerraformInstalled(): Promise<void> {
    try {
      execSync('terraform version', {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
    } catch {
      throw new ValidationError(
        'Terraform is not installed or not available in PATH. Please install Terraform and ensure it is in your PATH.'
      );
    }
  }

  /**
   * Check if git is available (not fatal if missing)
   * @returns True if git is available
   */
  static async validateGitRepo(cwd: string = process.cwd()): Promise<boolean> {
    return GitUtils.isGitRepository(cwd);
  }

  /**
   * Validate git working directory is clean (no uncommitted changes)
   * @param cwd - Current working directory
   * @throws {ValidationError} If working directory is not clean
   */
  static async validateGitCommit(cwd: string = process.cwd()): Promise<void> {
    const isClean = await GitUtils.isClean(cwd);
    if (!isClean) {
      throw new ValidationError(
        'Git working directory has uncommitted changes. Please commit or stash your changes before running this command. Use --skip-commit-check to bypass this validation.'
      );
    }
  }

  /**
   * Validate workspace name matches terraform naming rules
   * Must match: /^[a-zA-Z0-9_-]+$/
   * @param workspace - Workspace name to validate
   * @throws {ValidationError} If workspace name is invalid
   */
  static validateWorkspaceName(workspace: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(workspace)) {
      throw new ValidationError(
        `Invalid workspace name "${workspace}". Workspace names must match /^[a-zA-Z0-9_-]+$/ (alphanumeric, underscore, hyphen only).`
      );
    }
  }

  /**
   * Validate workspace is in allowed list (if configured)
   * @param workspace - Workspace name
   * @param config - Validation configuration
   * @throws {ValidationError} If workspace is not allowed
   */
  static validateAllowedWorkspace(workspace: string, config?: ValidationConfig): void {
    if (!config || !config.allowed_workspaces || config.allowed_workspaces.length === 0) {
      // No restrictions
      return;
    }

    if (!config.allowed_workspaces.includes(workspace)) {
      throw new ValidationError(
        `Workspace "${workspace}" is not in the allowed list. Allowed workspaces: ${config.allowed_workspaces.join(', ')}`
      );
    }
  }

  /**
   * Validate required variables are set
   * Checks for TF_VAR_* environment variables
   * @param requiredVars - List of required variable names (without TF_VAR_ prefix)
   * @param env - Environment variables
   * @throws {ValidationError} If required variables are missing
   */
  static validateRequiredVariables(
    requiredVars: string[],
    env: Record<string, string> = process.env as Record<string, string>
  ): void {
    if (!requiredVars || requiredVars.length === 0) {
      return;
    }

    const missing: string[] = [];
    for (const varName of requiredVars) {
      const envVarName = `TF_VAR_${varName}`;
      if (!env[envVarName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      throw new ValidationError(
        `Required Terraform variables are missing: ${missing.join(', ')}. Set them as environment variables: ${missing.map((v) => `TF_VAR_${v}`).join(', ')}`
      );
    }
  }

  /**
   * Validate backend configuration
   * @param config - Terraflow configuration
   * @throws {ValidationError} If backend configuration is invalid
   */
  static async validateBackendConfig(config: TerraflowConfig): Promise<void> {
    if (!config.backend) {
      return; // Local backend, no validation needed
    }

    // For now, basic validation - plugins will do detailed validation
    if (!config.backend.type) {
      throw new ValidationError('Backend type is required');
    }

    // TODO: Plugin-specific validation will be handled by backend plugins
  }

  /**
   * Validate cloud credentials are available (placeholder for future implementation)
   * @param backendType - Backend type
   * @param cloud - Cloud information
   * @throws {ValidationError} If credentials are missing
   */
  static async validateCloudCredentials(
    backendType: string,
    cloud: ExecutionContext['cloud']
  ): Promise<void> {
    if (backendType === 'local') {
      return; // No credentials needed for local backend
    }

    // TODO: Implement credential validation for AWS, Azure, GCP
    // For now, just check if provider is detected
    if (backendType === 's3' && cloud.provider !== 'aws') {
      Logger.warn('S3 backend configured but AWS provider not detected');
    }
    if (backendType === 'azurerm' && cloud.provider !== 'azure') {
      Logger.warn('Azure backend configured but Azure provider not detected');
    }
    if (backendType === 'gcs' && cloud.provider !== 'gcp') {
      Logger.warn('GCS backend configured but GCP provider not detected');
    }
  }

  /**
   * Validate plugin configurations (placeholder for future implementation)
   * @param _config - Terraflow configuration
   * @throws {ValidationError} If plugin configuration is invalid
   */
  static async validatePluginConfigs(_config: TerraflowConfig): Promise<void> {
    // TODO: Plugin validation will be handled by plugin system
    // This is a placeholder for future implementation
  }

  /**
   * Run validations based on command type
   * @param command - Terraform command
   * @param config - Terraflow configuration
   * @param context - Execution context
   * @param options - Validation options
   * @returns Validation result
   */
  static async validate(
    command: string,
    config: TerraflowConfig,
    context: ExecutionContext,
    options: {
      skipCommitCheck?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Always validate terraform installation
      await Validator.validateTerraformInstalled();
    } catch (error) {
      const message = error instanceof ValidationError ? error.message : String(error);
      errors.push(message);
      if (!options.dryRun) {
        throw error;
      }
    }

    try {
      // Always validate workspace name format
      Validator.validateWorkspaceName(context.workspace);
    } catch (error) {
      const message = error instanceof ValidationError ? error.message : String(error);
      errors.push(message);
      if (!options.dryRun) {
        throw error;
      }
    }

    // Check git availability (not fatal)
    const gitAvailable = await Validator.validateGitRepo(context.workingDir);
    if (!gitAvailable) {
      warnings.push('Git repository not detected. Some features may not work correctly.');
    }

    // Command-specific validations
    if (FULL_VALIDATION_COMMANDS.includes(command)) {
      await Validator.runFullValidations(config, context, options, errors, warnings);
    } else if (BACKEND_REQUIRED_COMMANDS.includes(command)) {
      await Validator.runBackendValidations(config, context, errors, warnings);
    }
    // MINIMAL_VALIDATION_COMMANDS only need terraform installed (already validated)

    // In dry-run mode, return errors without throwing
    if (options.dryRun && errors.length > 0) {
      return {
        passed: false,
        errors,
        warnings,
      };
    }

    // In normal mode, throw if there are errors
    if (errors.length > 0) {
      throw new ValidationError(`Validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    }

    return {
      passed: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Run full validations for apply, destroy, import, refresh commands
   */
  private static async runFullValidations(
    config: TerraflowConfig,
    context: ExecutionContext,
    options: { skipCommitCheck?: boolean; dryRun?: boolean },
    errors: string[],
    _warnings: string[]
  ): Promise<void> {
    // Git working directory clean
    if (!options.skipCommitCheck && !config['skip-commit-check']) {
      try {
        await Validator.validateGitCommit(context.workingDir);
      } catch (error) {
        const message = error instanceof ValidationError ? error.message : String(error);
        errors.push(message);
        if (!options.dryRun) {
          throw error;
        }
      }
    }

    // Workspace in allowed list
    try {
      Validator.validateAllowedWorkspace(context.workspace, config.validations);
    } catch (error) {
      const message = error instanceof ValidationError ? error.message : String(error);
      errors.push(message);
      if (!options.dryRun) {
        throw error;
      }
    }

    // Backend config valid
    try {
      await Validator.validateBackendConfig(config);
    } catch (error) {
      const message = error instanceof ValidationError ? error.message : String(error);
      errors.push(message);
      if (!options.dryRun) {
        throw error;
      }
    }

    // Cloud credentials available
    if (config.backend && config.backend.type !== 'local') {
      try {
        await Validator.validateCloudCredentials(config.backend.type, context.cloud);
      } catch (error) {
        const message = error instanceof ValidationError ? error.message : String(error);
        errors.push(message);
        if (!options.dryRun) {
          throw error;
        }
      }
    }

    // Plugin configs valid
    try {
      await Validator.validatePluginConfigs(config);
    } catch (error) {
      const message = error instanceof ValidationError ? error.message : String(error);
      errors.push(message);
      if (!options.dryRun) {
        throw error;
      }
    }
  }

  /**
   * Run backend validations for plan, state, workspace, output, show commands
   */
  private static async runBackendValidations(
    config: TerraflowConfig,
    context: ExecutionContext,
    errors: string[],
    _warnings: string[]
  ): Promise<void> {
    // Backend config valid (if not local)
    if (config.backend && config.backend.type !== 'local') {
      try {
        await Validator.validateBackendConfig(config);
      } catch (error) {
        const message = error instanceof ValidationError ? error.message : String(error);
        errors.push(message);
        throw error;
      }

      // Cloud credentials available
      try {
        await Validator.validateCloudCredentials(config.backend.type, context.cloud);
      } catch (error) {
        const message = error instanceof ValidationError ? error.message : String(error);
        errors.push(message);
        throw error;
      }
    }
  }
}
