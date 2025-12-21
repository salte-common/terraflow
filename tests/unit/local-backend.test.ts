/**
 * Unit tests for local backend plugin
 */

import { localBackend } from '../../src/plugins/backends/local';
import type { BackendConfig, ExecutionContext } from '../../src/types';

describe('Local Backend Plugin', () => {
  const mockBackendConfig: BackendConfig = {
    type: 'local',
  };

  const mockContext: ExecutionContext = {
    workspace: 'test',
    workingDir: '/tmp/test',
    cloud: { provider: 'none' },
    vcs: {},
    hostname: 'test-host',
    env: {},
    templateVars: {},
  };

  describe('validate', () => {
    it('should always succeed for local backend', async () => {
      await expect(localBackend.validate(mockBackendConfig)).resolves.not.toThrow();
    });

    it('should succeed with empty config', async () => {
      const emptyConfig: BackendConfig = {
        type: 'local',
        config: {},
      };
      await expect(localBackend.validate(emptyConfig)).resolves.not.toThrow();
    });

    it('should succeed with any config object', async () => {
      const configWithData: BackendConfig = {
        type: 'local',
        config: {
          someKey: 'someValue',
        },
      };
      await expect(localBackend.validate(configWithData)).resolves.not.toThrow();
    });
  });

  describe('getBackendConfig', () => {
    it('should return empty array for local backend', async () => {
      const result = await localBackend.getBackendConfig(mockBackendConfig, mockContext);
      expect(result).toEqual([]);
    });

    it('should return empty array regardless of config content', async () => {
      const configWithData: BackendConfig = {
        type: 'local',
        config: {
          path: '/some/path',
        },
      };
      const result = await localBackend.getBackendConfig(configWithData, mockContext);
      expect(result).toEqual([]);
    });

    it('should return empty array regardless of context', async () => {
      const differentContext: ExecutionContext = {
        workspace: 'production',
        workingDir: '/different/path',
        cloud: { provider: 'aws', awsRegion: 'us-east-1' },
        vcs: { branch: 'main' },
        hostname: 'prod-host',
        env: {},
        templateVars: {},
      };
      const result = await localBackend.getBackendConfig(mockBackendConfig, differentContext);
      expect(result).toEqual([]);
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(localBackend.name).toBe('local');
    });

    it('should not have setup method (optional)', () => {
      expect(localBackend.setup).toBeUndefined();
    });
  });
});

