/**
 * Environment setup
 * Sets up cloud, VCS, and Terraform environment
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'dotenv';
import type { TerraflowConfig, LoggingConfig } from '../types/config';
import type { ExecutionContext, CloudInfo, VcsInfo } from '../types/context';
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
   * @param config - Optional Terraflow configuration
   * @returns Updated cloud info
   */
  static async setupCloud(config?: {
    provider?: 'aws' | 'gcp' | 'azure';
  }): Promise<ExecutionContext['cloud']> {
    const cloud = await CloudUtils.detectCloud(config);

    // Sync AWS region if AWS provider detected
    if (cloud.provider === 'aws') {
      const region = CloudUtils.getAwsRegion();
      cloud.awsRegion = region;
      // Ensure AWS_REGION is in process.env for template resolution
      if (region && !process.env.AWS_REGION) {
        process.env.AWS_REGION = region;
      }
      // Ensure AWS_ACCOUNT_ID is in process.env for template resolution
      if (cloud.awsAccountId && !process.env.AWS_ACCOUNT_ID) {
        process.env.AWS_ACCOUNT_ID = cloud.awsAccountId;
      }
    }

    return cloud;
  }

  /**
   * Setup VCS environment (git variables)
   * Sets generic GIT_REPOSITORY variable and GitHub Actions/GitLab CI compatible variables
   * Automatically sets TF_VAR_git_repository for Terraform use
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
    // Set commit SHA (defaults to all zeros if git is not initialized)
    if (vcs.commitSha) {
      process.env.GIT_COMMIT_SHA = vcs.commitSha;
      // Calculate short SHA from commit SHA if not provided
      process.env.GIT_SHORT_SHA = vcs.shortSha || vcs.commitSha.substring(0, 7);
    } else {
      process.env.GIT_COMMIT_SHA = '0000000000000000000000000000000000000000';
      process.env.GIT_SHORT_SHA = '0000000';
    }

    // Set generic GIT_REPOSITORY (mapped from GitHub or GitLab)
    // This takes precedence: GitHub first, then GitLab
    // Default to "local" if no repository is detected
    if (vcs.githubRepository) {
      process.env.GIT_REPOSITORY = vcs.githubRepository;
    } else if (vcs.gitlabProjectPath) {
      process.env.GIT_REPOSITORY = vcs.gitlabProjectPath;
    } else {
      process.env.GIT_REPOSITORY = 'local';
    }

    // Automatically set TF_VAR_* variables for Terraform use
    // Only set if not already in environment (user can override)
    if (process.env.GIT_REPOSITORY && !process.env.TF_VAR_git_repository) {
      process.env.TF_VAR_git_repository = process.env.GIT_REPOSITORY;
    }
    if (process.env.GIT_COMMIT_SHA && !process.env.TF_VAR_git_commit_sha) {
      process.env.TF_VAR_git_commit_sha = process.env.GIT_COMMIT_SHA;
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
   * @returns Object containing updated context and resolved config with template variables substituted
   */
  static async setup(
    config: TerraflowConfig,
    context: ExecutionContext,
    projectRoot?: string
  ): Promise<{ context: ExecutionContext; resolvedConfig: TerraflowConfig }> {
    // 1. Load .env file from project root (where config file is), not terraform working directory
    // If projectRoot is not provided, try current working directory first, then fall back to workingDir
    const envDir = projectRoot || process.cwd();
    EnvironmentSetup.loadEnvFile(envDir);

    // 2. Setup cloud environment (detect account IDs, regions)
    const cloud = await EnvironmentSetup.setupCloud(config);
    context.cloud = cloud;

    // 3. Setup VCS environment (git branch, commit, repository)
    await EnvironmentSetup.setupVcs(context);

    // 4. Rebuild template variables to include .env file variables and updated cloud/VCS info
    context.templateVars = EnvironmentSetup.buildTemplateVars(
      context.cloud,
      context.vcs,
      context.hostname,
      context.workspace
    );

    // 5. Resolve template variables in config
    const resolvedConfig = EnvironmentSetup.resolveTemplateVars(config, context) as TerraflowConfig;

    // 6. Setup Terraform variables from config
    EnvironmentSetup.setupTerraformVariables(resolvedConfig);

    // 7. Setup logging configuration
    EnvironmentSetup.setupLogging(resolvedConfig);

    return { context, resolvedConfig };
  }

  /**
   * Build template variables from environment and context
   * This is similar to ContextBuilder.buildTemplateVars but needed here to rebuild after .env is loaded
   * @param cloud - Cloud information
   * @param vcs - VCS information
   * @param hostname - Machine hostname
   * @param workspace - Workspace name
   * @returns Template variables
   */
  static buildTemplateVars(
    cloud: CloudInfo,
    vcs: VcsInfo,
    hostname: string,
    workspace: string
  ): Record<string, string> {
    const vars: Record<string, string> = {
      HOSTNAME: hostname,
      WORKSPACE: workspace,
    };

    // Add all environment variables (including those from .env file)
    for (const key in process.env) {
      if (Object.prototype.hasOwnProperty.call(process.env, key)) {
        const value = process.env[key];
        if (value !== undefined) {
          vars[key] = value;
        }
      }
    }

    // Add cloud-specific variables
    if (cloud.awsAccountId) {
      vars.AWS_ACCOUNT_ID = cloud.awsAccountId;
    }
    if (cloud.awsRegion) {
      vars.AWS_REGION = cloud.awsRegion;
    }
    if (cloud.azureSubscriptionId) {
      vars.AZURE_SUBSCRIPTION_ID = cloud.azureSubscriptionId;
    }
    if (cloud.azureTenantId) {
      vars.AZURE_TENANT_ID = cloud.azureTenantId;
    }
    if (cloud.gcpProjectId) {
      vars.GCP_PROJECT_ID = cloud.gcpProjectId;
    }

    // Add VCS-specific variables
    if (vcs.branch) {
      vars.GIT_BRANCH = vcs.branch;
    }
    if (vcs.tag) {
      vars.GIT_TAG = vcs.tag;
    }
    // Set commit SHA (defaults to all zeros if git is not initialized)
    if (vcs.commitSha) {
      vars.GIT_COMMIT_SHA = vcs.commitSha;
      vars.GIT_SHORT_SHA = vcs.shortSha || vcs.commitSha.substring(0, 7);
    } else {
      vars.GIT_COMMIT_SHA = '0000000000000000000000000000000000000000';
      vars.GIT_SHORT_SHA = '0000000';
    }
    // Map both GitHub and GitLab to generic GIT_REPOSITORY
    // Default to "local" if no repository is detected
    if (vcs.githubRepository) {
      vars.GIT_REPOSITORY = vcs.githubRepository;
    } else if (vcs.gitlabProjectPath) {
      vars.GIT_REPOSITORY = vcs.gitlabProjectPath;
    } else {
      vars.GIT_REPOSITORY = 'local';
    }

    return vars;
  }
}
