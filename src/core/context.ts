/**
 * Execution context builder
 * Builds execution context from environment and configuration
 */

import os from 'os';
import type { ExecutionContext, CloudInfo, VcsInfo } from '../types/context';
import type { TerraflowConfig } from '../types/config';
import { ConfigManager } from './config';

/**
 * Execution context builder for Terraflow
 * Collects runtime state for command execution
 */
export class ContextBuilder {
  /**
   * Build execution context from configuration and environment
   * @param config - Terraflow configuration
   * @param cwd - Current working directory
   * @returns Execution context
   */
  static async build(
    config: TerraflowConfig,
    cwd: string = process.cwd()
  ): Promise<ExecutionContext> {
    const workspace = ConfigManager.getWorkspace(config) || 'default';
    const workingDir = ConfigManager.getWorkingDir(config, cwd);

    const cloud = await ContextBuilder.buildCloudInfo();
    const vcs = await ContextBuilder.buildVcsInfo();
    const hostname = os.hostname();

    // Build template variables from environment and context
    const templateVars = ContextBuilder.buildTemplateVars(cloud, vcs, hostname, workspace);

    // Build environment variables (sanitized, no secrets)
    const env: Record<string, string> = {};
    for (const key in process.env) {
      if (Object.prototype.hasOwnProperty.call(process.env, key)) {
        const value = process.env[key];
        if (value !== undefined) {
          env[key] = value;
        }
      }
    }

    return {
      workspace,
      workingDir,
      cloud,
      vcs,
      hostname,
      env,
      templateVars,
    };
  }

  /**
   * Build cloud provider information
   * @returns Cloud information
   */
  private static async buildCloudInfo(): Promise<CloudInfo> {
    // TODO: Implement cloud detection (AWS, Azure, GCP)
    // For now, return default
    return {
      provider: 'none',
    };
  }

  /**
   * Build VCS information
   * @returns VCS information
   */
  private static async buildVcsInfo(): Promise<VcsInfo> {
    // TODO: Implement git integration
    // For now, return empty VCS info
    return {};
  }

  /**
   * Build template variables for config resolution
   * @param cloud - Cloud information
   * @param vcs - VCS information
   * @param hostname - Machine hostname
   * @param workspace - Workspace name
   * @returns Template variables
   */
  private static buildTemplateVars(
    cloud: CloudInfo,
    vcs: VcsInfo,
    hostname: string,
    workspace: string
  ): Record<string, string> {
    const vars: Record<string, string> = {
      HOSTNAME: hostname,
      WORKSPACE: workspace,
    };

    // Add all environment variables
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
    if (vcs.commitSha) {
      vars.GIT_COMMIT_SHA = vcs.commitSha;
      vars.GIT_SHORT_SHA = vcs.commitSha.substring(0, 7);
    }
    if (vcs.githubRepository) {
      vars.GITHUB_REPOSITORY = vcs.githubRepository;
    }
    if (vcs.gitlabProjectPath) {
      vars.GITLAB_PROJECT_PATH = vcs.gitlabProjectPath;
    }

    return vars;
  }
}
