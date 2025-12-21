/**
 * Unit tests for backend state management
 */

import {
  loadBackendState,
  saveBackendState,
  detectBackendMigration,
} from '../../src/core/backend-state';
import type { BackendConfig } from '../../src/types/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Backend State Management', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terraflow-backend-state-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('saveBackendState and loadBackendState', () => {
    it('should save and load backend state', () => {
      const backend: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      saveBackendState(tempDir, backend);
      const loaded = loadBackendState(tempDir);

      expect(loaded).toEqual(backend);
    });

    it('should return null if state file does not exist', () => {
      const loaded = loadBackendState(tempDir);
      expect(loaded).toBeNull();
    });

    it('should create .terraflow directory if it does not exist', () => {
      const backend: BackendConfig = {
        type: 'local',
      };

      saveBackendState(tempDir, backend);

      expect(fs.existsSync(path.join(tempDir, '.terraflow'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.terraflow', 'state.json'))).toBe(true);
    });

    it('should handle invalid JSON gracefully', () => {
      const stateDir = path.join(tempDir, '.terraflow');
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(path.join(stateDir, 'state.json'), 'invalid json', 'utf8');

      const loaded = loadBackendState(tempDir);
      expect(loaded).toBeNull();
    });
  });

  describe('detectBackendMigration', () => {
    it('should return null if no previous state exists', () => {
      const currentBackend: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      const previousType = detectBackendMigration(tempDir, currentBackend);
      expect(previousType).toBeNull();
    });

    it('should return null if backend type has not changed', () => {
      const backend: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      saveBackendState(tempDir, backend);
      const previousType = detectBackendMigration(tempDir, backend);
      expect(previousType).toBeNull();
    });

    it('should return previous backend type if backend has changed', () => {
      const previousBackend: BackendConfig = {
        type: 'local',
      };

      const currentBackend: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      saveBackendState(tempDir, previousBackend);
      const previousType = detectBackendMigration(tempDir, currentBackend);

      expect(previousType).toBe('local');
    });

    it('should detect migration from s3 to local', () => {
      const previousBackend: BackendConfig = {
        type: 's3',
        config: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
        },
      };

      const currentBackend: BackendConfig = {
        type: 'local',
      };

      saveBackendState(tempDir, previousBackend);
      const previousType = detectBackendMigration(tempDir, currentBackend);

      expect(previousType).toBe('s3');
    });
  });
});

