/**
 * Integration tests for init command
 */

import { NewCommand } from '../../src/commands/new';
import { ConfigError } from '../../src/core/errors';
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('NewCommand Integration Tests', () => {
  const testBaseDir = join(__dirname, '..', '..', 'tmp', 'init-integration-test');

  /**
   * Create a temporary test directory
   */
  function createTestDir(name: string): string {
    const testDir = join(testBaseDir, name);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    return testDir;
  }

  /**
   * Verify file exists
   */
  function verifyFileExists(dir: string, filePath: string): void {
    const fullPath = join(dir, filePath);
    expect(existsSync(fullPath)).toBe(true);
  }

  /**
   * Read and verify file contents
   */
  function verifyFileContent(dir: string, filePath: string, expectedContent: string | RegExp): void {
    const fullPath = join(dir, filePath);
    const content = readFileSync(fullPath, 'utf8');
    if (expectedContent instanceof RegExp) {
      expect(content).toMatch(expectedContent);
    } else {
      expect(content).toContain(expectedContent);
    }
  }

  beforeEach(() => {
    // Clean up test base directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test base directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('AWS + JavaScript project', () => {
    it('should create complete AWS JavaScript project', async () => {
      const testDir = createTestDir('aws-js');
      const projectName = 'test-aws-js';

      await NewCommand.execute(projectName, {
        provider: 'aws',
        language: 'javascript',
        workingDir: testDir,
      });

      const projectDir = join(testDir, projectName);

      // Verify directory structure
      expect(existsSync(join(projectDir, 'src', 'main'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'test'))).toBe(true);
      expect(existsSync(join(projectDir, 'terraform', 'modules'))).toBe(true);

      // Verify Terraform files
      verifyFileExists(projectDir, 'terraform/_init.tf');
      verifyFileContent(projectDir, 'terraform/_init.tf', 'hashicorp/aws');
      verifyFileContent(projectDir, 'terraform/_init.tf', '~> 5.0');
      verifyFileContent(projectDir, 'terraform/_init.tf', 'backend "s3"');
      verifyFileExists(projectDir, 'terraform/inputs.tf');
      verifyFileExists(projectDir, 'terraform/locals.tf');
      verifyFileContent(projectDir, 'terraform/locals.tf', 'terraform.workspace');
      verifyFileExists(projectDir, 'terraform/main.tf');
      verifyFileExists(projectDir, 'terraform/outputs.tf');
      verifyFileExists(projectDir, 'terraform/modules/inputs.tf');
      verifyFileExists(projectDir, 'terraform/modules/main.tf');
      verifyFileExists(projectDir, 'terraform/modules/outputs.tf');

      // Verify application files
      verifyFileExists(projectDir, 'src/main/index.js');
      verifyFileContent(projectDir, 'src/main/index.js', projectName);
      verifyFileExists(projectDir, 'src/test/index.spec.js');
      verifyFileContent(projectDir, 'src/test/index.spec.js', projectName);

      // Verify configuration files
      verifyFileExists(projectDir, '.tfwconfig.yml');
      verifyFileContent(projectDir, '.tfwconfig.yml', 'type: s3');
      verifyFileExists(projectDir, '.env.example');
      verifyFileExists(projectDir, '.gitignore');
      verifyFileExists(projectDir, 'README.md');
      verifyFileContent(projectDir, 'README.md', `# ${projectName}`);
    });
  });

  describe('Azure + TypeScript project', () => {
    it('should create complete Azure TypeScript project', async () => {
      const testDir = createTestDir('azure-ts');
      const projectName = 'test-azure-ts';

      await NewCommand.execute(projectName, {
        provider: 'azure',
        language: 'typescript',
        workingDir: testDir,
      });

      const projectDir = join(testDir, projectName);

      // Verify Terraform files
      verifyFileContent(projectDir, 'terraform/_init.tf', 'hashicorp/azurerm');
      verifyFileContent(projectDir, 'terraform/_init.tf', '~> 3.0');
      verifyFileContent(projectDir, 'terraform/_init.tf', 'backend "azurerm"');

      // Verify application files
      verifyFileExists(projectDir, 'src/main/index.ts');
      verifyFileContent(projectDir, 'src/main/index.ts', projectName);
      verifyFileExists(projectDir, 'src/test/index.spec.ts');
      verifyFileExists(projectDir, 'tsconfig.json');

      // Verify configuration files
      verifyFileContent(projectDir, '.tfwconfig.yml', 'type: azurerm');
    });
  });

  describe('GCP + Python project', () => {
    it('should create complete GCP Python project', async () => {
      const testDir = createTestDir('gcp-py');
      const projectName = 'test-gcp-py';

      await NewCommand.execute(projectName, {
        provider: 'gcp',
        language: 'python',
        workingDir: testDir,
      });

      const projectDir = join(testDir, projectName);

      // Verify Terraform files
      verifyFileContent(projectDir, 'terraform/_init.tf', 'hashicorp/google');
      verifyFileContent(projectDir, 'terraform/_init.tf', '~> 5.0');
      verifyFileContent(projectDir, 'terraform/_init.tf', 'backend "gcs"');

      // Verify application files
      verifyFileExists(projectDir, 'src/main/index.py');
      verifyFileContent(projectDir, 'src/main/index.py', projectName);
      verifyFileExists(projectDir, 'src/test/test_main.py');
      verifyFileExists(projectDir, 'requirements.txt');
      verifyFileContent(projectDir, 'requirements.txt', 'pytest');

      // Verify configuration files
      verifyFileContent(projectDir, '.tfwconfig.yml', 'type: gcs');
    });
  });

  describe('Go project', () => {
    it('should create complete Go project', async () => {
      const testDir = createTestDir('go-project');
      const projectName = 'test-go';

      await NewCommand.execute(projectName, {
        provider: 'aws',
        language: 'go',
        workingDir: testDir,
      });

      const projectDir = join(testDir, projectName);

      // Verify application files
      verifyFileExists(projectDir, 'src/main/index.go');
      verifyFileContent(projectDir, 'src/main/index.go', projectName);
      verifyFileExists(projectDir, 'src/test/main_test.go');
      verifyFileExists(projectDir, 'go.mod');
      verifyFileContent(projectDir, 'go.mod', `module ${projectName}`);
    });
  });

  describe('Error handling', () => {
    it('should throw ConfigError for invalid project name', async () => {
      const testDir = createTestDir('invalid-name');

      await expect(
        NewCommand.execute('invalid name!', {
          workingDir: testDir,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError for invalid provider', async () => {
      const testDir = createTestDir('invalid-provider');

      await expect(
        NewCommand.execute('test-project', {
          provider: 'invalid',
          workingDir: testDir,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError for invalid language', async () => {
      const testDir = createTestDir('invalid-language');

      await expect(
        NewCommand.execute('test-project', {
          language: 'invalid',
          workingDir: testDir,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError if directory is not empty without --force', async () => {
      const testDir = createTestDir('non-empty');
      const projectDir = join(testDir, 'test-project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'existing.txt'), 'content');

      await expect(
        NewCommand.execute('test-project', {
          workingDir: testDir,
          force: false,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should succeed with --force on non-empty directory', async () => {
      const testDir = createTestDir('force-test');
      const projectDir = join(testDir, 'test-project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'existing.txt'), 'content');

      await NewCommand.execute('test-project', {
        workingDir: testDir,
        force: true,
      });

      // Project structure should be created
      expect(existsSync(join(projectDir, 'terraform'))).toBe(true);
      expect(existsSync(join(projectDir, '.tfwconfig.yml'))).toBe(true);
    });
  });

  describe('Current directory initialization', () => {
    it('should create project in current directory when no project name provided', async () => {
      const testDir = createTestDir('current-dir');

      await NewCommand.execute(undefined, {
        provider: 'aws',
        language: 'javascript',
        workingDir: testDir,
      });

      // Files should be created directly in testDir
      expect(existsSync(join(testDir, 'terraform'))).toBe(true);
      expect(existsSync(join(testDir, 'src'))).toBe(true);
      expect(existsSync(join(testDir, '.tfwconfig.yml'))).toBe(true);
      verifyFileContent(testDir, 'terraform/locals.tf', 'terraform.workspace');
    });
  });

  describe('File content verification', () => {
    it('should replace all template variables correctly', async () => {
      const testDir = createTestDir('template-vars');
      const projectName = 'my-awesome-project';

      await NewCommand.execute(projectName, {
        provider: 'aws',
        language: 'javascript',
        workingDir: testDir,
      });

      const projectDir = join(testDir, projectName);

      // Check locals.tf has correct structure (workspace, repository, commit hash)
      const localsContent = readFileSync(join(projectDir, 'terraform', 'locals.tf'), 'utf8');
      expect(localsContent).toContain('Workspace   = terraform.workspace');
      expect(localsContent).toContain('Repository  = var.git_repository');
      expect(localsContent).toContain('CommitHash  = var.git_commit_sha');

      // Check README has project name
      const readmeContent = readFileSync(join(projectDir, 'README.md'), 'utf8');
      expect(readmeContent).toContain(`# ${projectName}`);
      expect(readmeContent).not.toContain('<project-name>');

      // Check application files have project name
      const mainJs = readFileSync(join(projectDir, 'src', 'main', 'index.js'), 'utf8');
      expect(mainJs).toContain(projectName);
      expect(mainJs).not.toContain('<project-name>');
    });
  });
});

