/**
 * Environment setup
 * Sets up cloud, VCS, and Terraform environment
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'dotenv';
import type { TerraflowConfig, LoggingConfig } from '../types/config';
import type { ExecutionContext } from '../types/context';
import { CloudUtils } from '../utils/cloud';
import { Logger } from '../utils/logger';
import { TemplateUtils } from '../utils/templates';

/**
 * Environment setup utilities
 */
export class EnvironmentSetup {
  /**
   * Load .env file from working directory
   * Does NOT auto-convert to TF_VAR_* - only loads general environment variables
   * @param workingDir - Working directory path
   * @returns Record of environment variables from .env file
   */
  static loadEnvFile(workingDir: string): Record<string, string> {
    const envPath = join(workingDir, '.env');
    if (!existsSync(envPath)) {
      return {};
    }

    try {
      const envContent = readFileSync(envPath, 'utf8');
      const parsed = parse(envContent);

      // Set environment variables in process.env (but don't convert to TF_VAR_*)
      for (const key in parsed) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          const value = parsed[key];
          if (value !== undefined && process.env[key] === undefined) {
            // Only set if not already in process.env (env takes precedence)
            process.env[key] = value;
          }
        }
      }

      return parsed;
    } catch (error) {
      Logger.warn(
        `Failed to load .env file from ${workingDir}: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  /**
   * Setup cloud provider environment (AWS, Azure, GCP)
   * - Syncs AWS_REGION and AWS_DEFAULT_REGION
   * - Fetches account/subscription/project IDs
   * @returns Updated cloud info
   */
  static async setupCloud(): Promise<ExecutionContext['cloud']> {
    const cloud = await CloudUtils.detectCloud();

    // Sync AWS region if AWS provider detected
    if (cloud.provider === 'aws') {
      const region = CloudUtils.getAwsRegion();
      cloud.awsRegion = region;
    }

    return cloud;
  }

  /**
   * Setup VCS environment (git variables)
   * Sets GitHub Actions and GitLab CI compatible variables
   * @param context - Execution context
   * @returns Updated context with VCS environment variables
   */
  static async setupVcs(context: ExecutionContext): Promise<void> {
    const { vcs } = context;

    // Set basic git variables
    if (vcs.branch) {
      process.env.GIT_BRANCH = vcs.branch;
    }
    if (vcs.tag) {
      process.env.GIT_TAG = vcs.tag;
    }
    if (vcs.commitSha) {
      process.env.GIT_COMMIT_SHA = vcs.commitSha;
      process.env.GIT_SHORT_SHA = vcs.shortSha || vcs.commitSha.substring(0, 7);
    }

    // Simulate GitHub Actions variables
    if (vcs.githubRepository) {
      process.env.GITHUB_REPOSITORY = vcs.githubRepository;
      if (vcs.branch) {
        process.env.GITHUB_REF = `refs/heads/${vcs.branch}`;
      } else if (vcs.tag) {
        process.env.GITHUB_REF = `refs/tags/${vcs.tag}`;
      }
      if (vcs.commitSha) {
        process.env.GITHUB_SHA = vcs.commitSha;
      }
    }

    // Simulate GitLab CI variables
    if (vcs.gitlabProjectPath) {
      process.env.GITLAB_PROJECT_PATH = vcs.gitlabProjectPath;
      if (vcs.branch) {
        process.env.CI_COMMIT_REF_NAME = vcs.branch;
      } else if (vcs.tag) {
        process.env.CI_COMMIT_REF_NAME = vcs.tag;
      }
      if (vcs.commitSha) {
        process.env.CI_COMMIT_SHA = vcs.commitSha;
        process.env.CI_COMMIT_SHORT_SHA = vcs.shortSha || vcs.commitSha.substring(0, 7);
      }
    }
  }

  /**
   * Setup Terraform variables from config
   * Converts config.variables to TF_VAR_* environment variables
   * Does NOT convert .env file variables to TF_VAR_*
   * @param config - Terraflow configuration
   */
  static setupTerraformVariables(config: TerraflowConfig): void {
    if (!config.variables || typeof config.variables !== 'object') {
      return;
    }

    for (const key in config.variables) {
      if (Object.prototype.hasOwnProperty.call(config.variables, key)) {
        const value = config.variables[key];
        const envVarName = `TF_VAR_${key}`;

        // Only set if not already in environment (env takes precedence)
        if (process.env[envVarName] === undefined) {
          if (value === null || value === undefined) {
            process.env[envVarName] = '';
          } else if (typeof value === 'string') {
            process.env[envVarName] = value;
          } else {
            // Convert objects/arrays to JSON string
            process.env[envVarName] = JSON.stringify(value);
          }
        }
      }
    }
  }

  /**
   * Setup logging configuration
   * Sets Terraform log level if configured
   * @param config - Terraflow configuration
   */
  static setupLogging(config: TerraflowConfig): void {
    const logging: LoggingConfig | undefined = config.logging;

    if (!logging) {
      return;
    }

    // Set Terraform log level
    if (logging.terraform_log_level) {
      process.env.TF_LOG = logging.terraform_log_level;
    }

    // Enable/disable Terraform log
    if (logging.terraform_log !== undefined) {
      if (!logging.terraform_log) {
        // Disable terraform logging
        delete process.env.TF_LOG;
      } else if (!process.env.TF_LOG) {
        // Enable with default level if not set
        process.env.TF_LOG = logging.terraform_log_level || 'INFO';
      }
    }
  }

  /**
   * Resolve template variables in config recursively
   * Uses template vars from context
   * @param config - Terraflow configuration to resolve templates in
   * @param context - Execution context with template variables
   * @returns Configuration with templates resolved
   */
  static resolveTemplateVars(config: TerraflowConfig, context: ExecutionContext): TerraflowConfig {
    // Cast to Record<string, unknown> for template resolution
    const configRecord = config as unknown as Record<string, unknown>;
    const resolved = TemplateUtils.resolveObject(configRecord, context.templateVars);
    return resolved as unknown as TerraflowConfig;
  }

  /**
   * Setup complete environment
   * Executes all environment setup steps in order
   * @param config - Terraflow configuration
   * @param context - Execution context
   * @returns Updated context with environment setup complete
   */
  static async setup(
    config: TerraflowConfig,
    context: ExecutionContext
  ): Promise<ExecutionContext> {
    // 1. Load .env file (bootstrap credentials)
    EnvironmentSetup.loadEnvFile(context.workingDir);

    // 2. Setup cloud environment (detect account IDs, regions)
    const cloud = await EnvironmentSetup.setupCloud();
    context.cloud = cloud;

    // 3. Setup VCS environment (git branch, commit, repository)
    await EnvironmentSetup.setupVcs(context);

    // 4. Resolve template variables in config
    const resolvedConfig = EnvironmentSetup.resolveTemplateVars(config, context) as TerraflowConfig;

    // 5. Setup Terraform variables from config
    EnvironmentSetup.setupTerraformVariables(resolvedConfig);

    // 6. Setup logging configuration
    EnvironmentSetup.setupLogging(resolvedConfig);

    return context;
  }
}
