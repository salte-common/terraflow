# Plugin Development Guide

This guide explains how to develop plugins for Terraflow. Plugins extend Terraflow's functionality for backends, secrets management, and authentication.

## Plugin Types

Terraflow supports three types of plugins:

1. **Backend Plugins** - Manage Terraform state backend configuration
2. **Secrets Plugins** - Fetch secrets from external systems and convert to `TF_VAR_*` environment variables
3. **Auth Plugins** - Authenticate with cloud providers and set up credentials

## Plugin Discovery

Plugins are discovered automatically based on naming conventions:

- Backend plugins: `src/plugins/backends/{name}.ts` → export `{name}Backend`
- Secrets plugins: `src/plugins/secrets/{name}.ts` → export `{name}Secrets` or `{name}SecretManager`
- Auth plugins: `src/plugins/auth/{name}.ts` → export `{name}Auth` or similar

## Plugin Interfaces

### Backend Plugin

```typescript
interface BackendPlugin {
  name: string;
  validate(config: BackendConfig): Promise<void>;
  getBackendConfig(config: BackendConfig, context: ExecutionContext): Promise<string[]>;
  setup?(config: BackendConfig, context: ExecutionContext): Promise<void>;
}
```

**Methods:**

- `validate(config)` - Validate backend configuration. Throw `ConfigError` if invalid.
- `getBackendConfig(config, context)` - Generate `-backend-config` arguments for `terraform init`. Return array of strings like `["-backend-config=bucket=my-bucket", ...]`
- `setup(config, context)` - Optional setup hook (e.g., verify bucket exists)

**Example:**

```typescript
export const s3Backend: BackendPlugin = {
  name: 's3',
  validate: async (config: BackendConfig): Promise<void> => {
    if (!config.config?.bucket) {
      throw new ConfigError('S3 backend requires "bucket" configuration');
    }
    // ... more validation
  },
  getBackendConfig: async (
    config: BackendConfig,
    context: ExecutionContext
  ): Promise<string[]> => {
    const s3Config = config.config as S3BackendConfig;
    return [
      `-backend-config=bucket=${s3Config.bucket}`,
      `-backend-config=key=${s3Config.key}`,
      // ... more config
    ];
  },
  setup: async (config: BackendConfig, context: ExecutionContext): Promise<void> => {
    // Optional: verify bucket exists
  },
};
```

### Secrets Plugin

```typescript
interface SecretsPlugin {
  name: string;
  validate(config: SecretsConfig): Promise<void>;
  getSecrets(config: SecretsConfig, context: ExecutionContext): Promise<Record<string, string>>;
}
```

**Methods:**

- `validate(config)` - Validate secrets configuration. Throw `ConfigError` if invalid.
- `getSecrets(config, context)` - Fetch secrets and return as `TF_VAR_*` environment variables. All keys should be prefixed with `TF_VAR_`.

**Example:**

```typescript
export const awsSecrets: SecretsPlugin = {
  name: 'aws-secrets',
  validate: async (config: SecretsConfig): Promise<void> => {
    if (!config.config?.secret_name) {
      throw new ConfigError('AWS Secrets Manager requires "secret_name"');
    }
  },
  getSecrets: async (
    config: SecretsConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>> => {
    // Fetch secret from AWS Secrets Manager
    const secretValue = await fetchSecret(config.config.secret_name);
    const secretData = JSON.parse(secretValue);

    // Convert to TF_VAR_* format
    const tfVars: Record<string, string> = {};
    for (const key in secretData) {
      tfVars[`TF_VAR_${key}`] = String(secretData[key]);
    }
    return tfVars;
  },
};
```

**Important:** All secret keys must be prefixed with `TF_VAR_` so Terraform can access them as variables.

### Auth Plugin

```typescript
interface AuthPlugin {
  name: string;
  validate(config: AuthConfig): Promise<void>;
  authenticate(config: AuthConfig, context: ExecutionContext): Promise<Record<string, string>>;
}
```

**Methods:**

- `validate(config)` - Validate auth configuration. Throw `ConfigError` if invalid.
- `authenticate(config, context)` - Authenticate and return environment variables with credentials.

**Example:**

```typescript
export const awsAssumeRole: AuthPlugin = {
  name: 'aws-assume-role',
  validate: async (config: AuthConfig): Promise<void> => {
    if (!config.assume_role?.role_arn) {
      throw new ConfigError('AWS assume role requires "role_arn"');
    }
    // Validate ARN format
  },
  authenticate: async (
    config: AuthConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>> => {
    // Assume IAM role via STS
    const credentials = await assumeRole(config.assume_role.role_arn);

    return {
      AWS_ACCESS_KEY_ID: credentials.AccessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.SecretAccessKey,
      AWS_SESSION_TOKEN: credentials.SessionToken,
    };
  },
};
```

## Plugin Execution Order

Plugins are executed in this order:

1. **Auth Plugin** (if configured) - Sets up credentials
2. **Secrets Plugin** (if configured) - Fetches secrets as `TF_VAR_*` variables
3. **Backend Plugin** (always) - Configures Terraform backend

This order ensures credentials are available before fetching secrets or configuring backends.

## Working with Execution Context

The `ExecutionContext` provides information about the current execution:

```typescript
interface ExecutionContext {
  workspace: string;           // Resolved workspace name
  workingDir: string;          // Terraform working directory
  hostname: string;            // Machine hostname
  env: Record<string, string>; // Environment variables (sanitized)
  cloud: CloudInfo;            // Cloud provider information
  vcs: VcsInfo;                // Git/VCS information
  templateVars: Record<string, string>; // Available template variables
}
```

**Use template variables in configs:**

```typescript
const bucket = TemplateUtils.resolve(
  config.config.bucket,
  context.templateVars
);
```

## Error Handling

Always use `ConfigError` for configuration-related errors:

```typescript
import { ConfigError } from '../../core/errors';

if (!config.bucket) {
  throw new ConfigError('S3 backend requires "bucket" configuration');
}
```

For authentication/permission errors, provide helpful messages:

```typescript
catch (error) {
  if (error.name === 'AccessDenied') {
    throw new ConfigError(
      'Access denied. Ensure your credentials have permission to access this resource.'
    );
  }
  throw new ConfigError(`Failed to authenticate: ${error.message}`);
}
```

## Logging

Use the `Logger` utility for consistent logging:

```typescript
import { Logger } from '../../utils/logger';

Logger.debug('Fetching secret from AWS Secrets Manager');
Logger.info('✅ Successfully authenticated');
Logger.warn('⚠️  Encryption is disabled');
Logger.error('❌ Authentication failed');
```

## Template Variable Resolution

Plugins should support template variables in configuration values:

```typescript
import { TemplateUtils } from '../../utils/templates';

// Resolve templates in config
const resolvedConfig = TemplateUtils.resolveObject(
  config.config,
  context.templateVars
);
```

## Testing Plugins

### Unit Tests

Test plugin validation and configuration generation in isolation:

```typescript
describe('s3Backend', () => {
  it('should validate required fields', async () => {
    await expect(
      s3Backend.validate({ type: 's3', config: {} })
    ).rejects.toThrow(ConfigError);
  });

  it('should generate backend config arguments', async () => {
    const args = await s3Backend.getBackendConfig(
      { type: 's3', config: { bucket: 'my-bucket', key: 'state' } },
      mockContext
    );
    expect(args).toContain('-backend-config=bucket=my-bucket');
  });
});
```

### Integration Tests

Test plugins with mocked external services:

```typescript
describe('awsSecrets - Integration', () => {
  it('should fetch secrets and convert to TF_VAR_ format', async () => {
    mockSecretsManagerClient.mockResolvedValue({
      SecretString: JSON.stringify({ db_password: 'secret123' }),
    });

    const secrets = await awsSecrets.getSecrets(config, context);

    expect(secrets).toHaveProperty('TF_VAR_db_password', 'secret123');
  });
});
```

## Best Practices

1. **Validate Early** - Validate configuration in `validate()` method, not during execution
2. **Use Template Variables** - Support `${VAR}` syntax in configuration values
3. **Handle Errors Gracefully** - Provide clear, actionable error messages
4. **Log Appropriately** - Use appropriate log levels (debug for details, info for important steps)
5. **Follow Conventions** - Use naming conventions and follow existing plugin patterns
6. **Test Thoroughly** - Write unit tests for validation and config generation, integration tests for external API calls
7. **Document Assumptions** - Add JSDoc comments explaining plugin behavior
8. **Support Defaults** - Use sensible defaults where appropriate (e.g., `encrypt: true` for S3)

## Example Plugin: Simple Local Backend

```typescript
import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';

/**
 * Local backend plugin
 * Stores Terraform state locally (no remote backend)
 */
export const localBackend: BackendPlugin = {
  name: 'local',

  /**
   * Local backend always validates successfully
   */
  validate: async (_config: BackendConfig): Promise<void> => {
    // No validation needed for local backend
  },

  /**
   * Local backend doesn't require any -backend-config flags
   */
  getBackendConfig: async (
    _config: BackendConfig,
    _context: ExecutionContext
  ): Promise<string[]> => {
    return []; // No backend-config arguments
  },
};
```

## Example Plugin: Custom Secrets Provider

```typescript
import type { SecretsPlugin, SecretsConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';

/**
 * Custom secrets plugin example
 * Fetches secrets from a REST API
 */
export const customSecrets: SecretsPlugin = {
  name: 'custom-api',

  validate: async (config: SecretsConfig): Promise<void> => {
    if (!config.config?.api_url) {
      throw new ConfigError('Custom API secrets requires "api_url" configuration');
    }
  },

  getSecrets: async (
    config: SecretsConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>> => {
    const apiUrl = config.config.api_url;
    Logger.debug(`Fetching secrets from ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      const secretData = await response.json();

      // Convert to TF_VAR_* format
      const tfVars: Record<string, string> = {};
      for (const key in secretData) {
        tfVars[`TF_VAR_${key}`] = String(secretData[key]);
      }

      Logger.info(`✅ Loaded ${Object.keys(tfVars).length} secrets from custom API`);
      return tfVars;
    } catch (error) {
      throw new ConfigError(
        `Failed to fetch secrets from custom API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};
```

## Plugin Registration

Plugins are automatically discovered by the plugin loader. No manual registration needed. Just place your plugin file in the appropriate directory and export it with the correct name.

## Debugging Plugins

Enable debug logging to see plugin execution:

```bash
terraflow --debug plan
```

This shows:
- Plugin validation calls
- Configuration resolution
- Template variable substitution
- Plugin execution steps

## Next Steps

1. Review existing plugins in `src/plugins/` for examples
2. Write your plugin following the interface contracts
3. Add comprehensive unit and integration tests
4. Document your plugin's configuration requirements
5. Submit a pull request with your plugin

