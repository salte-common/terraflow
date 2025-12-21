/**
 * Integration tests for local backend initialization
 */

import { TerraformExecutor } from '../../src/core/terraform';
import { localBackend } from '../../src/plugins/backends/local';
import type { BackendConfig, ExecutionContext } from '../../src/types';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Local Backend - Terraform Init Integration', () => {
  let tempDir: string;
  let terraformDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terraflow-local-backend-test-'));
    terraformDir = path.join(tempDir, 'terraform');
    fs.mkdirSync(terraformDir, { recursive: true });

    // Create a minimal terraform configuration file
    const terraformConfig = `
terraform {
  required_version = ">= 1.0"
}

resource "null_resource" "test" {
  triggers = {
    test = "value"
  }
}
`;
    fs.writeFileSync(path.join(terraformDir, 'main.tf'), terraformConfig);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TerraformExecutor.init with local backend', () => {
    it('should initialize terraform without backend-config flags for local backend', async () => {
      const backendConfig: BackendConfig = {
        type: 'local',
      };

      // Get backend config from plugin (should be empty array)
      const backendArgs = await localBackend.getBackendConfig(backendConfig, {
        workspace: 'default',
        workingDir: terraformDir,
        cloud: { provider: 'none' },
        vcs: {},
        hostname: 'test-host',
        env: {},
        templateVars: {},
      });

      expect(backendArgs).toEqual([]);

      // Initialize terraform with local backend (no backend-config flags)
      // This should work without errors
      await TerraformExecutor.init('local', backendArgs, terraformDir);

      // Verify terraform was initialized (check for .terraform directory)
      const terraformDirExists = fs.existsSync(path.join(terraformDir, '.terraform'));
      expect(terraformDirExists).toBe(true);
    });

    it('should create workspace with local backend', async () => {
      const backendConfig: BackendConfig = {
        type: 'local',
      };

      // Initialize terraform first
      const backendArgs = await localBackend.getBackendConfig(backendConfig, {
        workspace: 'test-workspace',
        workingDir: terraformDir,
        cloud: { provider: 'none' },
        vcs: {},
        hostname: 'test-host',
        env: {},
        templateVars: {},
      });

      await TerraformExecutor.init('local', backendArgs, terraformDir);

      // Create workspace
      await TerraformExecutor.workspace('test-workspace', terraformDir);

      // Verify workspace was created by checking terraform workspace list
      const output = execSync('terraform workspace list', {
        cwd: terraformDir,
        encoding: 'utf8',
      });

      expect(output).toContain('test-workspace');
    });

    it('should handle workspace selection for existing workspace', async () => {
      const backendConfig: BackendConfig = {
        type: 'local',
      };

      // Initialize terraform
      const backendArgs = await localBackend.getBackendConfig(backendConfig, {
        workspace: 'default',
        workingDir: terraformDir,
        cloud: { provider: 'none' },
        vcs: {},
        hostname: 'test-host',
        env: {},
        templateVars: {},
      });

      await TerraformExecutor.init('local', backendArgs, terraformDir);

      // Create workspace
      await TerraformExecutor.workspace('test-workspace', terraformDir);

      // Select it again (should not fail)
      await TerraformExecutor.workspace('test-workspace', terraformDir);

      // Verify workspace is selected
      const output = execSync('terraform workspace show', {
        cwd: terraformDir,
        encoding: 'utf8',
      });

      expect(output.trim()).toBe('test-workspace');
    });
  });

  describe('Local backend plugin integration', () => {
    it('should validate local backend configuration', async () => {
      const backendConfig: BackendConfig = {
        type: 'local',
      };

      await expect(localBackend.validate(backendConfig)).resolves.not.toThrow();
    });

    it('should return empty backend config args for local backend', async () => {
      const backendConfig: BackendConfig = {
        type: 'local',
      };

      const context: ExecutionContext = {
        workspace: 'test',
        workingDir: terraformDir,
        cloud: { provider: 'none' },
        vcs: {},
        hostname: 'test-host',
        env: {},
        templateVars: {},
      };

      const backendArgs = await localBackend.getBackendConfig(backendConfig, context);
      expect(backendArgs).toEqual([]);
      expect(backendArgs.length).toBe(0);
    });
  });
});

