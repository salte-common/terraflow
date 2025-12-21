/**
 * Integration tests for workspace derivation
 */

import { ContextBuilder } from '../../src/core/context';
import { GitUtils } from '../../src/utils/git';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import type { TerraflowConfig } from '../../src/types/config';

describe('Workspace Derivation Integration', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terraflow-workspace-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.TERRAFLOW_WORKSPACE;
  });

  const initGitRepo = (): void => {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });
    execSync('echo "test" > test.txt', { cwd: tempDir });
    execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });
  };

  describe('Priority: CLI → env → tag → branch → hostname', () => {
    it('should use CLI parameter (highest priority)', async () => {
      const config: TerraflowConfig = {
        workspace: 'cli-workspace',
      };
      const context = await ContextBuilder.build(config, tempDir);
      expect(context.workspace).toBe('cli-workspace');
    });

    it('should use environment variable when CLI not set', async () => {
      process.env.TERRAFLOW_WORKSPACE = 'env-workspace';
      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);
      expect(context.workspace).toBe('env-workspace');
    });

    it('should prioritize CLI over environment variable', async () => {
      process.env.TERRAFLOW_WORKSPACE = 'env-workspace';
      const config: TerraflowConfig = {
        workspace: 'cli-workspace',
      };
      const context = await ContextBuilder.build(config, tempDir);
      expect(context.workspace).toBe('cli-workspace');
    });

    it('should use git tag when CLI and env not set', async () => {
      initGitRepo();
      execSync('git tag v1.0.0', { cwd: tempDir });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);
      // Tag is sanitized (dots become hyphens) per spec
      expect(context.workspace).toBe('v1-0-0');
    });

    it('should use git branch when CLI, env, and tag not set', async () => {
      initGitRepo();
      execSync('git checkout -b main', { cwd: tempDir, stdio: 'ignore' });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);
      expect(context.workspace).toBe('main');
    });

    it('should use hostname as fallback', async () => {
      const hostname = os.hostname();
      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);
      expect(context.workspace).toBe(GitUtils.sanitizeWorkspaceName(hostname));
    });
  });

  describe('Ephemeral branch detection', () => {
    it('should skip ephemeral branches and use hostname', async () => {
      initGitRepo();
      execSync('git checkout -b feature/new-feature', { cwd: tempDir, stdio: 'ignore' });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);

      // Should fall back to hostname since branch is ephemeral
      const hostname = os.hostname();
      expect(context.workspace).toBe(GitUtils.sanitizeWorkspaceName(hostname));
      expect(context.workspace).not.toBe('feature-new-feature');
    });

    it('should use non-ephemeral branches', async () => {
      initGitRepo();
      execSync('git checkout -b main', { cwd: tempDir, stdio: 'ignore' });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);
      expect(context.workspace).toBe('main');
    });

    it('should detect various ephemeral branch patterns', async () => {
      const ephemeralBranches = ['feature/test', 'bugfix/issue', 'release/v1.0', 'dave/exp'];

      for (const branch of ephemeralBranches) {
        // Create fresh repo for each branch
        const branchDir = fs.mkdtempSync(path.join(os.tmpdir(), `terraflow-branch-test-${Date.now()}-`));
        execSync('git init', { cwd: branchDir, stdio: 'ignore' });
        execSync('git config user.email "test@example.com"', { cwd: branchDir });
        execSync('git config user.name "Test User"', { cwd: branchDir });
        execSync('echo "test" > test.txt', { cwd: branchDir });
        execSync('git add test.txt', { cwd: branchDir, stdio: 'ignore' });
        execSync('git commit -m "Initial commit"', { cwd: branchDir, stdio: 'ignore' });
        execSync(`git checkout -b ${branch}`, { cwd: branchDir, stdio: 'ignore' });

        const config: TerraflowConfig = {};
        const context = await ContextBuilder.build(config, branchDir);

        const hostname = os.hostname();
        expect(context.workspace).toBe(GitUtils.sanitizeWorkspaceName(hostname));

        // Cleanup
        fs.rmSync(branchDir, { recursive: true, force: true });
      }
    });
  });

  describe('Workspace name sanitization', () => {
    it('should sanitize workspace names from git branches', async () => {
      initGitRepo();
      execSync('git checkout -b feature/new-vpc', { cwd: tempDir, stdio: 'ignore' });

      // Force using branch strategy, but include hostname as fallback
      const config: TerraflowConfig = {
        workspace_strategy: ['branch', 'hostname'],
      };
      const context = await ContextBuilder.build(config, tempDir);

      // Should sanitize but still be ephemeral, so falls back to hostname
      const hostname = os.hostname();
      expect(context.workspace).toBe(GitUtils.sanitizeWorkspaceName(hostname));
    });

    it('should sanitize tag names', async () => {
      initGitRepo();
      execSync('git tag v1.0.0', { cwd: tempDir });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);
      // Tag is sanitized (dots become hyphens) but original tag preserved in template vars
      expect(context.workspace).toBe('v1-0-0');
      expect(context.templateVars.GIT_TAG).toBe('v1.0.0'); // Original tag preserved
    });

    it('should sanitize CLI workspace names', async () => {
      const config: TerraflowConfig = {
        workspace: 'my/workspace name',
      };
      const context = await ContextBuilder.build(config, tempDir);
      expect(context.workspace).toBe('my-workspace-name');
      expect(/^[a-zA-Z0-9_-]+$/.test(context.workspace)).toBe(true);
    });
  });

  describe('Custom workspace strategy', () => {
    it('should respect workspace_strategy configuration', async () => {
      initGitRepo();
      execSync('git checkout -b main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git tag v1.0.0', { cwd: tempDir });

      // Only use hostname strategy
      const config: TerraflowConfig = {
        workspace_strategy: ['hostname'],
      };
      const context = await ContextBuilder.build(config, tempDir);

      const hostname = os.hostname();
      expect(context.workspace).toBe(GitUtils.sanitizeWorkspaceName(hostname));
    });

    it('should skip strategies not in workspace_strategy', async () => {
      initGitRepo();
      execSync('git checkout -b main', { cwd: tempDir, stdio: 'ignore' });

      // Skip tag and branch, go straight to hostname
      const config: TerraflowConfig = {
        workspace_strategy: ['tag', 'hostname'], // branch not included
      };
      const context = await ContextBuilder.build(config, tempDir);

      const hostname = os.hostname();
      expect(context.workspace).toBe(GitUtils.sanitizeWorkspaceName(hostname));
    });
  });

  describe('VCS information in context', () => {
    it('should populate VCS info from git repository', async () => {
      initGitRepo();
      execSync('git checkout -b test-branch', { cwd: tempDir, stdio: 'ignore' });
      execSync('git remote add origin https://github.com/owner/repo.git', { cwd: tempDir });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);

      expect(context.vcs.branch).toBe('test-branch');
      expect(context.vcs.commitSha).toBeDefined();
      expect(context.vcs.shortSha).toBeDefined();
      expect(context.vcs.githubRepository).toBe('owner/repo');
      expect(context.vcs.isClean).toBe(true);
    });

    it('should handle GitLab repositories', async () => {
      initGitRepo();
      execSync('git remote add origin https://gitlab.com/group/project.git', { cwd: tempDir });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);

      expect(context.vcs.gitlabProjectPath).toBe('group/project');
    });

    it('should return empty VCS info for non-git directories', async () => {
      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);

      expect(context.vcs.branch).toBeUndefined();
      expect(context.vcs.tag).toBeUndefined();
      expect(context.vcs.commitSha).toBeUndefined();
    });
  });

  describe('Template variables', () => {
    it('should include VCS variables in template vars', async () => {
      initGitRepo();
      execSync('git checkout -b main', { cwd: tempDir, stdio: 'ignore' });
      execSync('git remote add origin https://github.com/owner/repo.git', { cwd: tempDir });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);

      expect(context.templateVars.GIT_BRANCH).toBe('main');
      expect(context.templateVars.GIT_COMMIT_SHA).toBeDefined();
      expect(context.templateVars.GIT_SHORT_SHA).toBeDefined();
      expect(context.templateVars.GITHUB_REPOSITORY).toBe('owner/repo');
      expect(context.templateVars.WORKSPACE).toBe('main');
      expect(context.templateVars.HOSTNAME).toBe(os.hostname());
    });

    it('should include tag in template vars when on tag', async () => {
      initGitRepo();
      execSync('git tag v1.0.0', { cwd: tempDir });

      const config: TerraflowConfig = {};
      const context = await ContextBuilder.build(config, tempDir);

      // Original tag preserved in template vars
      expect(context.templateVars.GIT_TAG).toBe('v1.0.0');
      // Workspace name is sanitized
      expect(context.workspace).toBe('v1-0-0');
    });
  });
});

