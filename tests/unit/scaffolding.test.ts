/**
 * Unit tests for scaffolding utilities
 */

import {
  validateProjectName,
  validateProvider,
  validateLanguage,
  processTemplate,
  loadTemplate,
  isDirectoryEmpty,
  buildTemplateVariables,
  generateGitHooks,
  configureGitHooksPath,
  initializeGitRepository,
  generateEditorSettings,
} from '../../src/utils/scaffolding';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

describe('Scaffolding Utilities', () => {
  describe('validateProjectName', () => {
    it('should accept valid project names', () => {
      expect(validateProjectName('my-project')).toBe(true);
      expect(validateProjectName('my_project')).toBe(true);
      expect(validateProjectName('myProject123')).toBe(true);
      expect(validateProjectName('project-123_test')).toBe(true);
      expect(validateProjectName('a')).toBe(true);
      expect(validateProjectName('123')).toBe(true);
    });

    it('should reject invalid project names', () => {
      expect(validateProjectName('my project')).toBe(false); // space
      expect(validateProjectName('my.project')).toBe(false); // dot
      expect(validateProjectName('my@project')).toBe(false); // @
      expect(validateProjectName('my/project')).toBe(false); // slash
      expect(validateProjectName('')).toBe(false); // empty
      expect(validateProjectName('project-name!')).toBe(false); // exclamation
    });
  });

  describe('validateProvider', () => {
    it('should accept valid providers', () => {
      expect(validateProvider('aws')).toBe(true);
      expect(validateProvider('azure')).toBe(true);
      expect(validateProvider('gcp')).toBe(true);
    });

    it('should reject invalid providers', () => {
      expect(validateProvider('invalid')).toBe(false);
      expect(validateProvider('AWS')).toBe(false); // case sensitive
      expect(validateProvider('')).toBe(false);
      expect(validateProvider('aws-')).toBe(false);
    });
  });

  describe('validateLanguage', () => {
    it('should accept valid languages', () => {
      expect(validateLanguage('javascript')).toBe(true);
      expect(validateLanguage('typescript')).toBe(true);
      expect(validateLanguage('python')).toBe(true);
      expect(validateLanguage('go')).toBe(true);
    });

    it('should reject invalid languages', () => {
      expect(validateLanguage('invalid')).toBe(false);
      expect(validateLanguage('JavaScript')).toBe(false); // case sensitive
      expect(validateLanguage('')).toBe(false);
      expect(validateLanguage('js')).toBe(false);
    });
  });

  describe('processTemplate', () => {
    it('should replace single variable', () => {
      const template = 'Hello from <project-name>!';
      const result = processTemplate(template, { 'project-name': 'test-project' });
      expect(result).toBe('Hello from test-project!');
    });

    it('should replace multiple variables', () => {
      const template = 'Project: <project-name>, Provider: <provider>';
      const result = processTemplate(template, {
        'project-name': 'my-project',
        provider: 'aws',
      });
      expect(result).toBe('Project: my-project, Provider: aws');
    });

    it('should replace multiple occurrences', () => {
      const template = '<project-name> is great. <project-name> is awesome.';
      const result = processTemplate(template, { 'project-name': 'test' });
      expect(result).toBe('test is great. test is awesome.');
    });

    it('should leave unmatched placeholders unchanged', () => {
      const template = 'Hello from <project-name> and <unknown>!';
      const result = processTemplate(template, { 'project-name': 'test' });
      expect(result).toBe('Hello from test and <unknown>!');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello from <project-name>!';
      const result = processTemplate(template, {});
      expect(result).toBe('Hello from <project-name>!');
    });

    it('should handle empty template', () => {
      const result = processTemplate('', { 'project-name': 'test' });
      expect(result).toBe('');
    });
  });

  describe('loadTemplate', () => {
    it('should load existing template file', () => {
      const content = loadTemplate('terraform/locals.tf.template');
      expect(content).toContain('locals');
      expect(content).toContain('terraform.workspace');
      expect(content).toContain('var.git_repository');
    });

    it('should throw ConfigError for non-existent template', () => {
      expect(() => loadTemplate('non-existent/template.template')).toThrow();
    });
  });

  describe('isDirectoryEmpty', () => {
    const testDir = join(__dirname, '..', '..', 'tmp', 'scaffolding-test');

    beforeEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should return true for non-existent directory', async () => {
      const result = await isDirectoryEmpty(testDir);
      expect(result).toBe(true);
    });

    it('should return true for empty directory', async () => {
      mkdirSync(testDir, { recursive: true });
      const result = await isDirectoryEmpty(testDir);
      expect(result).toBe(true);
    });

    it('should return false for directory with files', async () => {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, 'test.txt'), 'content');
      const result = await isDirectoryEmpty(testDir);
      expect(result).toBe(false);
    });

    it('should return false for directory with subdirectories', async () => {
      mkdirSync(join(testDir, 'subdir'), { recursive: true });
      const result = await isDirectoryEmpty(testDir);
      expect(result).toBe(false);
    });
  });

  describe('buildTemplateVariables', () => {
    it('should build variables for AWS provider', () => {
      const vars = buildTemplateVariables('my-project', 'aws', 'javascript');
      expect(vars['project-name']).toBe('my-project');
      expect(vars.provider).toBe('s3');
      expect(vars['provider-name']).toBe('aws');
    });

    it('should build variables for Azure provider', () => {
      const vars = buildTemplateVariables('my-project', 'azure', 'typescript');
      expect(vars['project-name']).toBe('my-project');
      expect(vars.provider).toBe('azurerm');
      expect(vars['provider-name']).toBe('azure');
    });

    it('should build variables for GCP provider', () => {
      const vars = buildTemplateVariables('my-project', 'gcp', 'python');
      expect(vars['project-name']).toBe('my-project');
      expect(vars.provider).toBe('gcs');
      expect(vars['provider-name']).toBe('gcp');
    });
  });

  describe('generateGitHooks', () => {
    const testDir = join(__dirname, '..', '..', 'tmp', 'githooks-test');

    beforeEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should create pre-commit hook and setup script', () => {
      generateGitHooks(testDir);

      const preCommit = join(testDir, '.githooks', 'pre-commit');
      const setupScript = join(testDir, 'scripts', 'setup-githooks.sh');

      expect(existsSync(preCommit)).toBe(true);
      expect(existsSync(setupScript)).toBe(true);
      expect(readFileSync(preCommit, 'utf8')).toContain('AKIA[0-9A-Z]{16}');
      expect(readFileSync(setupScript, 'utf8')).toContain('core.hooksPath .githooks');
    });
  });

  describe('generateEditorSettings', () => {
    const testDir = join(__dirname, '..', '..', 'tmp', 'vscode-settings-test');

    beforeEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should create language-specific VS Code settings', () => {
      generateEditorSettings(testDir, 'typescript');

      const settingsPath = join(testDir, '.vscode', 'settings.json');
      expect(existsSync(settingsPath)).toBe(true);
      const settings = readFileSync(settingsPath, 'utf8');
      expect(settings).toContain('"editor.formatOnSave": true');
      expect(settings).toContain('source.fixAll.eslint');
      expect(settings).toContain('hashicorp.terraform');
    });
  });

  describe('configureGitHooksPath', () => {
    const testDir = join(__dirname, '..', '..', 'tmp', 'githooks-config-test');

    beforeEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should skip when not a git repository', () => {
      expect(() => configureGitHooksPath(testDir)).not.toThrow();
    });
  });

  describe('initializeGitRepository', () => {
    const testDir = join(__dirname, '..', '..', 'tmp', 'git-init-test');

    beforeEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, 'README.md'), '# test\n');
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should init git, configure hooks, and create initial commit', () => {
      generateGitHooks(testDir);
      initializeGitRepository(testDir);

      expect(existsSync(join(testDir, '.git', 'HEAD'))).toBe(true);
      const hooksPath = execSync('git config core.hooksPath', {
        cwd: testDir,
        encoding: 'utf8',
      }).trim();
      expect(hooksPath).toBe('.githooks');
      const subject = execSync('git log -1 --format=%s', {
        cwd: testDir,
        encoding: 'utf8',
      }).trim();
      expect(subject).toBe('Initialized');
    });
  });
});

