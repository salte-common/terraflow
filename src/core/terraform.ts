/**
 * Terraform executor
 * Executes terraform commands with proper environment setup
 */

import { execSync } from 'child_process';
import { Logger } from '../utils/logger';

/**
 * Terraform executor for running terraform commands
 */
export class TerraformExecutor {
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
  static async execute(command: string, args: string[], workingDir: string): Promise<void> {
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
