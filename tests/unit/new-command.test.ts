/**
 * Unit tests for NewCommand
 */

import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NewCommand } from '../../src/commands/new';
import { ConfigError } from '../../src/core/errors';

describe('NewCommand', () => {
  const testDir = join(__dirname, '..', '..', 'tmp', 'init-test');
  const projectName = 'test-project';

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('execute', () => {
    it('should create project structure with default options', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        workingDir: testDir,
      });

      expect(existsSync(projectDir)).toBe(true);
      expect(existsSync(join(projectDir, 'terraform'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'main'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'test'))).toBe(true);
      expect(existsSync(join(projectDir, '.tfwconfig.yml'))).toBe(true);
      expect(existsSync(join(projectDir, '.env.example'))).toBe(true);
      expect(existsSync(join(projectDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(projectDir, 'README.md'))).toBe(true);
    });

    it('should create AWS provider files', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        provider: 'aws',
        workingDir: testDir,
      });

      const initTf = readFileSync(join(projectDir, 'terraform', '_init.tf'), 'utf8');
      expect(initTf).toContain('hashicorp/aws');
      expect(initTf).toContain('~> 5.0');
      expect(initTf).toContain('backend "s3"');

      const tfwconfig = readFileSync(join(projectDir, '.tfwconfig.yml'), 'utf8');
      expect(tfwconfig).toContain('type: s3');
      expect(tfwconfig).toContain('provider: aws');
    });

    it('should create Azure provider files', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        provider: 'azure',
        workingDir: testDir,
      });

      const initTf = readFileSync(join(projectDir, 'terraform', '_init.tf'), 'utf8');
      expect(initTf).toContain('hashicorp/azurerm');
      expect(initTf).toContain('~> 3.0');
      expect(initTf).toContain('backend "azurerm"');

      const tfwconfig = readFileSync(join(projectDir, '.tfwconfig.yml'), 'utf8');
      expect(tfwconfig).toContain('type: azurerm');
      expect(tfwconfig).toContain('provider: azure');
    });

    it('should create GCP provider files', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        provider: 'gcp',
        workingDir: testDir,
      });

      const initTf = readFileSync(join(projectDir, 'terraform', '_init.tf'), 'utf8');
      expect(initTf).toContain('hashicorp/google');
      expect(initTf).toContain('~> 5.0');
      expect(initTf).toContain('backend "gcs"');

      const tfwconfig = readFileSync(join(projectDir, '.tfwconfig.yml'), 'utf8');
      expect(tfwconfig).toContain('type: gcs');
      expect(tfwconfig).toContain('provider: gcp');
    });

    it('should create JavaScript application files', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        language: 'javascript',
        workingDir: testDir,
      });

      expect(existsSync(join(projectDir, 'src', 'main', 'index.js'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'test', 'index.spec.js'))).toBe(true);

      const mainJs = readFileSync(join(projectDir, 'src', 'main', 'index.js'), 'utf8');
      expect(mainJs).toContain(projectName);
    });

    it('should create TypeScript application files', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        language: 'typescript',
        workingDir: testDir,
      });

      expect(existsSync(join(projectDir, 'src', 'main', 'index.ts'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'test', 'index.spec.ts'))).toBe(true);
      expect(existsSync(join(projectDir, 'tsconfig.json'))).toBe(true);
    });

    it('should create Python application files', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        language: 'python',
        workingDir: testDir,
      });

      expect(existsSync(join(projectDir, 'src', 'main', 'index.py'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'test', 'test_main.py'))).toBe(true);
      expect(existsSync(join(projectDir, 'requirements.txt'))).toBe(true);
    });

    it('should create Go application files', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        language: 'go',
        workingDir: testDir,
      });

      expect(existsSync(join(projectDir, 'src', 'main', 'index.go'))).toBe(true);
      expect(existsSync(join(projectDir, 'src', 'test', 'main_test.go'))).toBe(true);
      expect(existsSync(join(projectDir, 'go.mod'))).toBe(true);

      const goMod = readFileSync(join(projectDir, 'go.mod'), 'utf8');
      expect(goMod).toContain(projectName);
    });

    it('should replace project name in templates', async () => {
      const projectDir = join(testDir, projectName);
      await NewCommand.execute(projectName, {
        workingDir: testDir,
      });

      const readme = readFileSync(join(projectDir, 'README.md'), 'utf8');
      expect(readme).toContain(`# ${projectName}`);
      expect(readme).not.toContain('<project-name>');

      const localsTf = readFileSync(join(projectDir, 'terraform', 'locals.tf'), 'utf8');
      expect(localsTf).toContain('Workspace   = terraform.workspace');
      expect(localsTf).toContain('Repository  = var.git_repository');
      expect(localsTf).toContain('CommitHash  = var.git_commit_sha');
    });

    it('should throw ConfigError for invalid provider', async () => {
      await expect(
        NewCommand.execute(projectName, {
          provider: 'invalid',
          workingDir: testDir,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError for invalid language', async () => {
      await expect(
        NewCommand.execute(projectName, {
          language: 'invalid',
          workingDir: testDir,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError for invalid project name', async () => {
      await expect(
        NewCommand.execute('invalid name!', {
          workingDir: testDir,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should throw ConfigError if directory exists and not empty without --force', async () => {
      const projectDir = join(testDir, projectName);
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'existing-file.txt'), 'content');

      await expect(
        NewCommand.execute(projectName, {
          workingDir: testDir,
          force: false,
        })
      ).rejects.toThrow(ConfigError);
    });

    it('should overwrite existing files with --force', async () => {
      const projectDir = join(testDir, projectName);
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'existing-file.txt'), 'content');

      await NewCommand.execute(projectName, {
        workingDir: testDir,
        force: true,
      });

      // Project structure should still be created
      expect(existsSync(join(projectDir, 'terraform'))).toBe(true);
      expect(existsSync(join(projectDir, '.tfwconfig.yml'))).toBe(true);
    });

    it('should create project in current directory if no project name provided', async () => {
      const currentDir = join(testDir, 'current');
      mkdirSync(currentDir, { recursive: true });
      process.chdir(currentDir);

      await NewCommand.execute(undefined, {
        workingDir: currentDir,
      });

      expect(existsSync(join(currentDir, 'terraform'))).toBe(true);
      expect(existsSync(join(currentDir, '.tfwconfig.yml'))).toBe(true);

      process.chdir(__dirname);
    });
  });
});

