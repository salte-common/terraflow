/**
 * Unit tests for git utilities
 */

import { GitUtils } from '../../src/utils/git';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('GitUtils', () => {
  let tempDir: string;
  let gitDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terraflow-git-test-'));
    gitDir = path.join(tempDir, '.git');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('isGitRepository', () => {
    it('should return false for non-git directory', () => {
      expect(GitUtils.isGitRepository(tempDir)).toBe(false);
    });

    it('should return true for git directory', () => {
      fs.mkdirSync(gitDir);
      expect(GitUtils.isGitRepository(tempDir)).toBe(true);
    });
  });

  describe('getBranch', () => {
    it('should return undefined for non-git repository', async () => {
      const branch = await GitUtils.getBranch(tempDir);
      expect(branch).toBeUndefined();
    });

    it('should return branch name for git repository', async () => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout -b test-branch', { cwd: tempDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('echo "test" > test.txt', { cwd: tempDir });
      execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });

      const branch = await GitUtils.getBranch(tempDir);
      expect(branch).toBe('test-branch');
    });
  });

  describe('getTag', () => {
    it('should return undefined for non-git repository', async () => {
      const tag = await GitUtils.getTag(tempDir);
      expect(tag).toBeUndefined();
    });

    it('should return undefined when not on a tag', async () => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('echo "test" > test.txt', { cwd: tempDir });
      execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });

      const tag = await GitUtils.getTag(tempDir);
      expect(tag).toBeUndefined();
    });

    it('should return tag name when on a tag', async () => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('echo "test" > test.txt', { cwd: tempDir });
      execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });
      execSync('git tag v1.0.0', { cwd: tempDir });

      const tag = await GitUtils.getTag(tempDir);
      expect(tag).toBe('v1.0.0');
    });
  });

  describe('getCommitSha', () => {
    it('should return undefined for non-git repository', async () => {
      const sha = await GitUtils.getCommitSha(tempDir);
      expect(sha).toBeUndefined();
    });

    it('should return commit SHA for git repository', async () => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('echo "test" > test.txt', { cwd: tempDir });
      execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });

      const sha = await GitUtils.getCommitSha(tempDir);
      expect(sha).toBeDefined();
      expect(sha?.length).toBe(40); // Full SHA is 40 characters
    });
  });

  describe('getShortSha', () => {
    it('should return undefined for non-git repository', async () => {
      const sha = await GitUtils.getShortSha(tempDir);
      expect(sha).toBeUndefined();
    });

    it('should return short commit SHA for git repository', async () => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('echo "test" > test.txt', { cwd: tempDir });
      execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });

      const sha = await GitUtils.getShortSha(tempDir);
      expect(sha).toBeDefined();
      expect(sha?.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('isClean', () => {
    it('should return true for non-git repository', async () => {
      const isClean = await GitUtils.isClean(tempDir);
      expect(isClean).toBe(true);
    });

    it('should return true for clean working directory', async () => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('echo "test" > test.txt', { cwd: tempDir });
      execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });

      const isClean = await GitUtils.isClean(tempDir);
      expect(isClean).toBe(true);
    });

    it('should return false for dirty working directory', async () => {
      execSync('git init', { cwd: tempDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test User"', { cwd: tempDir });
      execSync('echo "test" > test.txt', { cwd: tempDir });
      execSync('git add test.txt', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });
      execSync('echo "modified" > test.txt', { cwd: tempDir });

      const isClean = await GitUtils.isClean(tempDir);
      expect(isClean).toBe(false);
    });
  });

  describe('parseGithubUrl', () => {
    it('should parse https GitHub URL', () => {
      const url = 'https://github.com/owner/repo.git';
      const result = GitUtils.parseGithubUrl(url);
      expect(result).toBe('owner/repo');
    });

    it('should parse https GitHub URL without .git', () => {
      const url = 'https://github.com/owner/repo';
      const result = GitUtils.parseGithubUrl(url);
      expect(result).toBe('owner/repo');
    });

    it('should parse git@ GitHub URL', () => {
      const url = 'git@github.com:owner/repo.git';
      const result = GitUtils.parseGithubUrl(url);
      expect(result).toBe('owner/repo');
    });

    it('should parse git@ GitHub URL without .git', () => {
      const url = 'git@github.com:owner/repo';
      const result = GitUtils.parseGithubUrl(url);
      expect(result).toBe('owner/repo');
    });

    it('should return undefined for non-GitHub URL', () => {
      const url = 'https://gitlab.com/owner/repo';
      const result = GitUtils.parseGithubUrl(url);
      expect(result).toBeUndefined();
    });
  });

  describe('parseGitlabUrl', () => {
    it('should parse https GitLab URL', () => {
      const url = 'https://gitlab.com/group/project.git';
      const result = GitUtils.parseGitlabUrl(url);
      expect(result).toBe('group/project');
    });

    it('should parse https GitLab URL with subgroup', () => {
      const url = 'https://gitlab.com/group/subgroup/project.git';
      const result = GitUtils.parseGitlabUrl(url);
      expect(result).toBe('group/subgroup/project');
    });

    it('should parse git@ GitLab URL', () => {
      const url = 'git@gitlab.com:group/project.git';
      const result = GitUtils.parseGitlabUrl(url);
      expect(result).toBe('group/project');
    });

    it('should return undefined for non-GitLab URL', () => {
      const url = 'https://github.com/owner/repo';
      const result = GitUtils.parseGitlabUrl(url);
      expect(result).toBeUndefined();
    });
  });

  describe('isEphemeralBranch', () => {
    it('should return true for feature branch', () => {
      expect(GitUtils.isEphemeralBranch('feature/new-vpc')).toBe(true);
    });

    it('should return true for bugfix branch', () => {
      expect(GitUtils.isEphemeralBranch('bugfix/auth-issue')).toBe(true);
    });

    it('should return true for release branch', () => {
      expect(GitUtils.isEphemeralBranch('release/v1.2.0')).toBe(true);
    });

    it('should return true for user branch', () => {
      expect(GitUtils.isEphemeralBranch('dave/experiment')).toBe(true);
    });

    it('should return false for main branch', () => {
      expect(GitUtils.isEphemeralBranch('main')).toBe(false);
    });

    it('should return false for master branch', () => {
      expect(GitUtils.isEphemeralBranch('master')).toBe(false);
    });

    it('should return false for develop branch', () => {
      expect(GitUtils.isEphemeralBranch('develop')).toBe(false);
    });

    it('should match regex /^[^/]+\\//', () => {
      expect(/^[^/]+\//.test('feature/test')).toBe(true);
      expect(/^[^/]+\//.test('main')).toBe(false);
    });
  });

  describe('sanitizeWorkspaceName', () => {
    it('should remove refs/heads/ prefix', () => {
      const result = GitUtils.sanitizeWorkspaceName('refs/heads/main');
      expect(result).toBe('main');
    });

    it('should remove refs/tags/ prefix and sanitize dots', () => {
      const result = GitUtils.sanitizeWorkspaceName('refs/tags/v1.0.0');
      expect(result).toBe('v1-0-0');
    });

    it('should replace slashes with hyphens', () => {
      const result = GitUtils.sanitizeWorkspaceName('feature/new-vpc');
      expect(result).toBe('feature-new-vpc');
    });

    it('should replace spaces with hyphens', () => {
      const result = GitUtils.sanitizeWorkspaceName('my workspace');
      expect(result).toBe('my-workspace');
    });

    it('should remove invalid characters', () => {
      const result = GitUtils.sanitizeWorkspaceName('workspace@123!');
      expect(result).toBe('workspace123');
    });

    it('should remove leading/trailing hyphens', () => {
      const result = GitUtils.sanitizeWorkspaceName('---workspace---');
      expect(result).toBe('workspace');
    });

    it('should match required pattern /^[a-zA-Z0-9_-]+$/', () => {
      const result = GitUtils.sanitizeWorkspaceName('valid_workspace-123');
      expect(/^[a-zA-Z0-9_-]+$/.test(result)).toBe(true);
    });

    it('should return default for empty result', () => {
      const result = GitUtils.sanitizeWorkspaceName('---');
      expect(result).toBe('default');
    });
  });
});

