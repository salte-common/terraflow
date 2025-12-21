/**
 * Unit tests for environment secrets plugin
 */

import { envSecrets } from '../../src/plugins/secrets/env';
import type { SecretsConfig, ExecutionContext } from '../../src/types';

describe('Environment Secrets Plugin', () => {
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
    it('should always succeed - no validation needed', async () => {
      const config: SecretsConfig = {
        provider: 'env',
      };

      await expect(envSecrets.validate(config)).resolves.not.toThrow();
    });

    it('should succeed with empty config', async () => {
      const config: SecretsConfig = {
        provider: 'env',
        config: {},
      };

      await expect(envSecrets.validate(config)).resolves.not.toThrow();
    });

    it('should succeed with any config object', async () => {
      const config: SecretsConfig = {
        provider: 'env',
        config: {
          someKey: 'someValue',
        },
      };

      await expect(envSecrets.validate(config)).resolves.not.toThrow();
    });

    it('should succeed without config object', async () => {
      const config: SecretsConfig = {
        provider: 'env',
      };

      await expect(envSecrets.validate(config)).resolves.not.toThrow();
    });
  });

  describe('getSecrets', () => {
    it('should return empty object', async () => {
      const config: SecretsConfig = {
        provider: 'env',
      };

      const result = await envSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({});
      expect(Object.keys(result).length).toBe(0);
    });

    it('should return empty object regardless of config', async () => {
      const config: SecretsConfig = {
        provider: 'env',
        config: {
          region: 'us-east-1',
        },
      };

      const result = await envSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({});
    });

    it('should return empty object regardless of context', async () => {
      const config: SecretsConfig = {
        provider: 'env',
      };

      const differentContext: ExecutionContext = {
        workspace: 'production',
        workingDir: '/different/path',
        cloud: { provider: 'aws', awsRegion: 'us-east-1' },
        vcs: { branch: 'main' },
        hostname: 'prod-host',
        env: {
          TF_VAR_secret: 'value',
        },
        templateVars: {},
      };

      const result = await envSecrets.getSecrets(config, differentContext);

      // Should still return empty object - secrets come from .env or existing env vars
      // This plugin doesn't fetch or convert anything
      expect(result).toEqual({});
    });

    it('should always return new empty object (not shared reference)', async () => {
      const config: SecretsConfig = {
        provider: 'env',
      };

      const result1 = await envSecrets.getSecrets(config, mockContext);
      const result2 = await envSecrets.getSecrets(config, mockContext);

      expect(result1).toEqual({});
      expect(result2).toEqual({});
      expect(result1).not.toBe(result2); // Different object instances
    });
  });

  describe('plugin interface', () => {
    it('should have correct name', () => {
      expect(envSecrets.name).toBe('env');
    });

    it('should implement validate method', () => {
      expect(typeof envSecrets.validate).toBe('function');
    });

    it('should implement getSecrets method', () => {
      expect(typeof envSecrets.getSecrets).toBe('function');
    });
  });

  describe('no-op behavior', () => {
    it('should be a no-op plugin that does not fetch secrets', async () => {
      const config: SecretsConfig = {
        provider: 'env',
      };

      // This plugin doesn't actually fetch secrets
      // It returns empty object because secrets come from .env file
      // (loaded separately) or existing environment variables
      const result = await envSecrets.getSecrets(config, mockContext);

      expect(result).toEqual({});
      // No secrets are fetched or converted
    });

    it('should not require any configuration', async () => {
      // Validation always succeeds
      await expect(envSecrets.validate({ provider: 'env' })).resolves.not.toThrow();
    });
  });
});

