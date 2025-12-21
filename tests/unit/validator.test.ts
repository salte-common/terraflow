/**
 * Unit tests for validation engine
 */

import {
  Validator,
  FULL_VALIDATION_COMMANDS,
  BACKEND_REQUIRED_COMMANDS,
  MINIMAL_VALIDATION_COMMANDS,
} from '../../src/core/validator';
import { ValidationError } from '../../src/core/errors';
import { GitUtils } from '../../src/utils/git';
import type { TerraflowConfig, ValidationConfig } from '../../src/types/config';
import type { ExecutionContext } from '../../src/types/context';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock GitUtils
jest.mock('../../src/utils/git');

describe('Validator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terraflow-validator-test-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validateTerraformInstalled', () => {
    it('should pass when terraform is installed', async () => {
      // Mock execSync to simulate terraform being available
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue('Terraform v1.0.0');

      await expect(Validator.validateTerraformInstalled()).resolves.not.toThrow();
    });

    it('should throw ValidationError when terraform is not installed', async () => {
      // Mock execSync to throw error (terraform not found)
      jest.spyOn(require('child_process'), 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });

      await expect(Validator.validateTerraformInstalled()).rejects.toThrow(ValidationError);
      await expect(Validator.validateTerraformInstalled()).rejects.toThrow(
        'Terraform is not installed'
      );
    });
  });

  describe('validateGitRepo', () => {
    it('should return true when in git repository', async () => {
      (GitUtils.isGitRepository as jest.Mock).mockReturnValue(true);

      const result = await Validator.validateGitRepo(tempDir);
      expect(result).toBe(true);
      expect(GitUtils.isGitRepository).toHaveBeenCalledWith(tempDir);
    });

    it('should return false when not in git repository', async () => {
      (GitUtils.isGitRepository as jest.Mock).mockReturnValue(false);

      const result = await Validator.validateGitRepo(tempDir);
      expect(result).toBe(false);
    });
  });

  describe('validateGitCommit', () => {
    it('should pass when working directory is clean', async () => {
      (GitUtils.isClean as jest.Mock).mockResolvedValue(true);

      await expect(Validator.validateGitCommit(tempDir)).resolves.not.toThrow();
    });

    it('should throw ValidationError when working directory is dirty', async () => {
      (GitUtils.isClean as jest.Mock).mockResolvedValue(false);

      await expect(Validator.validateGitCommit(tempDir)).rejects.toThrow(ValidationError);
      await expect(Validator.validateGitCommit(tempDir)).rejects.toThrow(
        'uncommitted changes'
      );
    });
  });

  describe('validateWorkspaceName', () => {
    it('should pass for valid workspace names', () => {
      const validNames = ['main', 'production', 'dev-123', 'workspace_name', 'test-ws-123'];

      for (const name of validNames) {
        expect(() => Validator.validateWorkspaceName(name)).not.toThrow();
      }
    });

    it('should throw ValidationError for invalid workspace names', () => {
      const invalidNames = [
        'workspace/name',
        'workspace name',
        'workspace.name',
        'workspace@name',
        '',
      ];

      for (const name of invalidNames) {
        expect(() => Validator.validateWorkspaceName(name)).toThrow(ValidationError);
        expect(() => Validator.validateWorkspaceName(name)).toThrow('Invalid workspace name');
      }
    });
  });

  describe('validateAllowedWorkspace', () => {
    it('should pass when no allowed list is configured', () => {
      expect(() => Validator.validateAllowedWorkspace('any-workspace', undefined)).not.toThrow();
      expect(() =>
        Validator.validateAllowedWorkspace('any-workspace', { allowed_workspaces: [] })
      ).not.toThrow();
    });

    it('should pass when workspace is in allowed list', () => {
      const config: ValidationConfig = {
        allowed_workspaces: ['production', 'staging', 'development'],
      };

      expect(() =>
        Validator.validateAllowedWorkspace('production', config)
      ).not.toThrow();
      expect(() => Validator.validateAllowedWorkspace('staging', config)).not.toThrow();
    });

    it('should throw ValidationError when workspace is not in allowed list', () => {
      const config: ValidationConfig = {
        allowed_workspaces: ['production', 'staging'],
      };

      expect(() => Validator.validateAllowedWorkspace('development', config)).toThrow(
        ValidationError
      );
      expect(() => Validator.validateAllowedWorkspace('development', config)).toThrow(
        'not in the allowed list'
      );
    });
  });

  describe('validateRequiredVariables', () => {
    it('should pass when all required variables are set', () => {
      const env = {
        TF_VAR_environment: 'production',
        TF_VAR_instance_count: '3',
        TF_VAR_region: 'us-east-1',
      };

      expect(() =>
        Validator.validateRequiredVariables(['environment', 'instance_count'], env)
      ).not.toThrow();
    });

    it('should pass when no required variables specified', () => {
      expect(() => Validator.validateRequiredVariables([])).not.toThrow();
      expect(() => Validator.validateRequiredVariables([], {})).not.toThrow();
    });

    it('should throw ValidationError when required variables are missing', () => {
      const env = {
        TF_VAR_environment: 'production',
      };

      expect(() =>
        Validator.validateRequiredVariables(['environment', 'instance_count'], env)
      ).toThrow(ValidationError);
      expect(() =>
        Validator.validateRequiredVariables(['environment', 'instance_count'], env)
      ).toThrow('Required Terraform variables are missing');
    });
  });

  describe('validateBackendConfig', () => {
    it('should pass when backend is not configured', async () => {
      const config: TerraflowConfig = {};
      await expect(Validator.validateBackendConfig(config)).resolves.not.toThrow();
    });

    it('should pass when backend type is specified', async () => {
      const config: TerraflowConfig = {
        backend: {
          type: 's3',
        },
      };
      await expect(Validator.validateBackendConfig(config)).resolves.not.toThrow();
    });

    it('should throw ValidationError when backend type is missing', async () => {
      const config: TerraflowConfig = {
        backend: {
          type: '',
        },
      };
      await expect(Validator.validateBackendConfig(config)).rejects.toThrow(ValidationError);
    });
  });

  describe('Command categorization', () => {
    it('should have correct full validation commands', () => {
      expect(FULL_VALIDATION_COMMANDS).toEqual(['apply', 'destroy', 'import', 'refresh']);
    });

    it('should have correct backend required commands', () => {
      expect(BACKEND_REQUIRED_COMMANDS).toEqual(['plan', 'state', 'workspace', 'output', 'show']);
    });

    it('should have correct minimal validation commands', () => {
      expect(MINIMAL_VALIDATION_COMMANDS).toEqual(['fmt', 'validate', 'version', 'providers']);
    });
  });

  describe('validate - Full validation commands', () => {
    const mockContext: ExecutionContext = {
      workspace: 'test-workspace',
      workingDir: tempDir,
      cloud: { provider: 'none' },
      vcs: {},
      hostname: 'test-host',
      env: {},
      templateVars: {},
    };

    beforeEach(() => {
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue('Terraform v1.0.0');
      (GitUtils.isGitRepository as jest.Mock).mockReturnValue(true);
      (GitUtils.isClean as jest.Mock).mockResolvedValue(true);
    });

    it('should run all validations for apply command', async () => {
      const config: TerraflowConfig = {
        backend: { type: 'local' },
      };

      const result = await Validator.validate('apply', config, mockContext);

      expect(result.passed).toBe(true);
      expect(GitUtils.isClean).toHaveBeenCalled();
    });

    it('should skip git commit check when skipCommitCheck is true', async () => {
      const config: TerraflowConfig = {
        backend: { type: 'local' },
      };

      await Validator.validate('apply', config, mockContext, { skipCommitCheck: true });

      // GitUtils.isClean should not be called when skipCommitCheck is true
      expect(GitUtils.isClean).not.toHaveBeenCalled();
    });

    it('should validate allowed workspace for full validation commands', async () => {
      const config: TerraflowConfig = {
        backend: { type: 'local' },
        validations: {
          allowed_workspaces: ['production'],
        },
      };

      await expect(Validator.validate('apply', config, mockContext)).rejects.toThrow(
        ValidationError
      );
    });

    it('should pass when workspace is in allowed list', async () => {
      const config: TerraflowConfig = {
        backend: { type: 'local' },
        validations: {
          allowed_workspaces: ['test-workspace'],
        },
      };

      const result = await Validator.validate('apply', config, mockContext);
      expect(result.passed).toBe(true);
    });
  });

  describe('validate - Backend required commands', () => {
    const mockContext: ExecutionContext = {
      workspace: 'test-workspace',
      workingDir: tempDir,
      cloud: { provider: 'none' },
      vcs: {},
      hostname: 'test-host',
      env: {},
      templateVars: {},
    };

    beforeEach(() => {
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue('Terraform v1.0.0');
      (GitUtils.isGitRepository as jest.Mock).mockReturnValue(true);
    });

    it('should validate backend for plan command', async () => {
      const config: TerraflowConfig = {
        backend: { type: 'local' },
      };

      const result = await Validator.validate('plan', config, mockContext);
      expect(result.passed).toBe(true);
    });
  });

  describe('validate - Minimal validation commands', () => {
    const mockContext: ExecutionContext = {
      workspace: 'test-workspace',
      workingDir: tempDir,
      cloud: { provider: 'none' },
      vcs: {},
      hostname: 'test-host',
      env: {},
      templateVars: {},
    };

    beforeEach(() => {
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue('Terraform v1.0.0');
      (GitUtils.isGitRepository as jest.Mock).mockReturnValue(true);
    });

    it('should only validate terraform installation for fmt command', async () => {
      const config: TerraflowConfig = {};

      const result = await Validator.validate('fmt', config, mockContext);
      expect(result.passed).toBe(true);
      expect(GitUtils.isClean).not.toHaveBeenCalled();
    });
  });

  describe('validate - Dry run mode', () => {
    const mockContext: ExecutionContext = {
      workspace: 'test-workspace',
      workingDir: tempDir,
      cloud: { provider: 'none' },
      vcs: {},
      hostname: 'test-host',
      env: {},
      templateVars: {},
    };

    beforeEach(() => {
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue('Terraform v1.0.0');
      (GitUtils.isGitRepository as jest.Mock).mockReturnValue(true);
      (GitUtils.isClean as jest.Mock).mockResolvedValue(false); // Dirty working directory
    });

    it('should collect errors but not throw in dry-run mode', async () => {
      const config: TerraflowConfig = {
        backend: { type: 'local' },
      };

      const result = await Validator.validate('apply', config, mockContext, { dryRun: true });

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('uncommitted changes'))).toBe(true);
    });

    it('should include warnings in dry-run mode', async () => {
      (GitUtils.isGitRepository as jest.Mock).mockReturnValue(false);

      const config: TerraflowConfig = {
        backend: { type: 'local' },
      };

      const result = await Validator.validate('apply', config, mockContext, { dryRun: true });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('Git repository not detected'))).toBe(true);
    });
  });

  describe('validate - Invalid workspace name', () => {
    const mockContext: ExecutionContext = {
      workspace: 'invalid/workspace',
      workingDir: tempDir,
      cloud: { provider: 'none' },
      vcs: {},
      hostname: 'test-host',
      env: {},
      templateVars: {},
    };

    beforeEach(() => {
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue('Terraform v1.0.0');
    });

    it('should throw ValidationError for invalid workspace name', async () => {
      const config: TerraflowConfig = {};

      await expect(Validator.validate('fmt', config, mockContext)).rejects.toThrow(
        ValidationError
      );
      await expect(Validator.validate('fmt', config, mockContext)).rejects.toThrow(
        'Invalid workspace name'
      );
    });
  });
});

