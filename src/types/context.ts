/**
 * Execution context type definitions
 */

/**
 * Cloud provider information
 */
export interface CloudInfo {
  /** Detected cloud provider: aws | azure | gcp | none */
  provider: 'aws' | 'azure' | 'gcp' | 'none';
  /** AWS account ID (if AWS) */
  awsAccountId?: string;
  /** AWS region */
  awsRegion?: string;
  /** Azure subscription ID (if Azure) */
  azureSubscriptionId?: string;
  /** Azure tenant ID (if Azure) */
  azureTenantId?: string;
  /** GCP project ID (if GCP) */
  gcpProjectId?: string;
}

/**
 * Git/VCS information
 */
export interface VcsInfo {
  /** Current git branch */
  branch?: string;
  /** Current git tag */
  tag?: string;
  /** Full git commit SHA */
  commitSha?: string;
  /** Short git commit SHA */
  shortSha?: string;
  /** GitHub repository (owner/repo) */
  githubRepository?: string;
  /** GitLab project path */
  gitlabProjectPath?: string;
  /** Whether working directory is clean */
  isClean?: boolean;
}

/**
 * Execution context passed to plugins and commands
 */
export interface ExecutionContext {
  /** Resolved workspace name */
  workspace: string;
  /** Working directory path */
  workingDir: string;
  /** Cloud provider information */
  cloud: CloudInfo;
  /** VCS information */
  vcs: VcsInfo;
  /** Machine hostname */
  hostname: string;
  /** Environment variables (sanitized, no secrets) */
  env: Record<string, string>;
  /** Template variables for config resolution */
  templateVars: Record<string, string>;
}
