/**
 * Git operations utility
 * Provides git-related functionality for workspace derivation
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Git utilities for workspace derivation and VCS information
 */
export class GitUtils {
  /**
   * Check if current directory is in a git repository
   * @param cwd - Working directory to check
   * @returns True if in a git repository
   */
  static isGitRepository(cwd: string = process.cwd()): boolean {
    const gitDir = path.join(cwd, '.git');
    return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
  }

  /**
   * Get current git branch name
   * @param cwd - Working directory
   * @returns Branch name or undefined if not in git repo or not on a branch
   */
  static async getBranch(cwd: string = process.cwd()): Promise<string | undefined> {
    if (!GitUtils.isGitRepository(cwd)) {
      return undefined;
    }

    try {
      const result = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const branch = result.trim();
      return branch && branch !== 'HEAD' ? branch : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get current git tag if HEAD is on a tag
   * @param cwd - Working directory
   * @returns Tag name or undefined if not on a tag
   */
  static async getTag(cwd: string = process.cwd()): Promise<string | undefined> {
    if (!GitUtils.isGitRepository(cwd)) {
      return undefined;
    }

    try {
      const result = execSync('git describe --exact-match --tags HEAD 2>/dev/null', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const tag = result.trim();
      return tag || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get git commit SHA (full)
   * @param cwd - Working directory
   * @returns Full commit SHA or undefined
   */
  static async getCommitSha(cwd: string = process.cwd()): Promise<string | undefined> {
    if (!GitUtils.isGitRepository(cwd)) {
      return undefined;
    }

    try {
      const result = execSync('git rev-parse HEAD', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return result.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get short git commit SHA (7 characters)
   * @param cwd - Working directory
   * @returns Short commit SHA or undefined
   */
  static async getShortSha(cwd: string = process.cwd()): Promise<string | undefined> {
    if (!GitUtils.isGitRepository(cwd)) {
      return undefined;
    }

    try {
      const result = execSync('git rev-parse --short HEAD', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return result.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if git working directory is clean (no uncommitted changes)
   * @param cwd - Working directory
   * @returns True if working directory is clean
   */
  static async isClean(cwd: string = process.cwd()): Promise<boolean> {
    if (!GitUtils.isGitRepository(cwd)) {
      return true; // Not a git repo, consider it "clean"
    }

    try {
      execSync('git diff-index --quiet HEAD --', {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get GitHub repository name from git remote (format: owner/repo)
   * @param cwd - Working directory
   * @returns Repository name in format "owner/repo" or undefined
   */
  static async getGithubRepository(cwd: string = process.cwd()): Promise<string | undefined> {
    if (!GitUtils.isGitRepository(cwd)) {
      return undefined;
    }

    try {
      const result = execSync('git remote get-url origin', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const url = result.trim();
      return GitUtils.parseGithubUrl(url);
    } catch {
      return undefined;
    }
  }

  /**
   * Get GitLab project path from git remote
   * @param cwd - Working directory
   * @returns GitLab project path or undefined
   */
  static async getGitlabProjectPath(cwd: string = process.cwd()): Promise<string | undefined> {
    if (!GitUtils.isGitRepository(cwd)) {
      return undefined;
    }

    try {
      const result = execSync('git remote get-url origin', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const url = result.trim();
      return GitUtils.parseGitlabUrl(url);
    } catch {
      return undefined;
    }
  }

  /**
   * Parse GitHub URL to extract owner/repo
   * Supports https://, git@, and git:// formats
   * @param url - Git remote URL
   * @returns Repository name in format "owner/repo" or undefined
   */
  static parseGithubUrl(url: string): string | undefined {
    // Match patterns:
    // https://github.com/owner/repo.git
    // https://github.com/owner/repo
    // git@github.com:owner/repo.git
    // git@github.com:owner/repo
    // git://github.com/owner/repo.git
    const patterns = [
      /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/,
      /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
    }

    return undefined;
  }

  /**
   * Parse GitLab URL to extract project path
   * Supports https:// and git@ formats
   * @param url - Git remote URL
   * @returns GitLab project path or undefined
   */
  static parseGitlabUrl(url: string): string | undefined {
    // Match patterns:
    // https://gitlab.com/group/subgroup/project.git
    // https://gitlab.com/group/subgroup/project
    // git@gitlab.com:group/subgroup/project.git
    // git@gitlab.com:group/subgroup/project
    const patterns = [/gitlab\.com[/:](.+?)(?:\.git)?$/, /gitlab\.com[/:](.+?)(?:\.git)?\/?$/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Check if a branch name is ephemeral (has a prefix like "feature/")
   * Uses regex: /^[^/]+\//
   * @param branchName - Branch name to check
   * @returns True if branch is ephemeral
   */
  static isEphemeralBranch(branchName: string): boolean {
    return /^[^/]+\//.test(branchName);
  }

  /**
   * Sanitize workspace name according to spec
   * - Remove refs/heads/ or refs/tags/ prefix
   * - Replace invalid characters (/ and spaces) with hyphens
   * - Result must match /^[a-zA-Z0-9_-]+$/
   * @param name - Workspace name to sanitize
   * @returns Sanitized workspace name
   */
  static sanitizeWorkspaceName(name: string): string {
    // Remove refs/heads/ or refs/tags/ prefix
    let sanitized = name.replace(/^refs\/(heads|tags)\//, '');

    // Replace invalid characters (/, spaces, dots) with hyphens
    sanitized = sanitized.replace(/[/\s.]+/g, '-');

    // Remove any remaining invalid characters (keep only alphanumeric, underscore, hyphen)
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');

    // Remove leading/trailing hyphens
    sanitized = sanitized.replace(/^-+|-+$/g, '');

    // Ensure it matches the required pattern
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
      // Fallback to safe default if sanitization fails
      sanitized = 'default';
    }

    return sanitized || 'default';
  }
}
