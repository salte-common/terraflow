/**
 * S3 backend plugin
 * Handles AWS S3 Terraform state backend
 */

import type { BackendPlugin, BackendConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';
import { TemplateUtils } from '../../utils/templates';

/**
 * S3 backend configuration interface
 */
interface S3BackendConfig {
  bucket: string;
  key: string;
  region?: string;
  encrypt?: boolean;
  dynamodb_table?: string;
  kms_key_id?: string;
  profile?: string;
  role_arn?: string;
  session_name?: string;
  external_id?: string;
  assume_role_duration_seconds?: number;
  access_key?: string;
  secret_key?: string;
  token?: string;
  iam_endpoint?: string;
  max_retries?: number;
  sse_customer_key?: string;
  skip_credentials_validation?: boolean;
  skip_metadata_api_check?: boolean;
  skip_region_validation?: boolean;
  force_path_style?: boolean;
}

/**
 * S3 backend plugin
 */
export const s3Backend: BackendPlugin = {
  name: 's3',

  /**
   * Validate S3 backend configuration
   * @param config - Backend configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: BackendConfig): Promise<void> => {
    if (!config.config) {
      throw new ConfigError('S3 backend requires configuration');
    }

    const s3Config = config.config as unknown as S3BackendConfig;

    // Required fields
    if (!s3Config.bucket) {
      throw new ConfigError('S3 backend requires "bucket" configuration');
    }

    if (!s3Config.key) {
      throw new ConfigError('S3 backend requires "key" configuration');
    }

    // Warn if encrypt is false (not secure)
    if (s3Config.encrypt === false) {
      Logger.warn(
        '⚠️  S3 backend encryption is disabled. This is not recommended for production use.'
      );
    }
  },

  /**
   * Generate Terraform backend configuration arguments
   * @param config - Backend configuration
   * @param context - Execution context (for template variable resolution)
   * @returns Array of -backend-config arguments for terraform init
   */
  getBackendConfig: async (config: BackendConfig, context: ExecutionContext): Promise<string[]> => {
    if (!config.config) {
      throw new ConfigError('S3 backend requires configuration');
    }

    // Resolve template variables in config
    const resolvedConfig = TemplateUtils.resolveObject(
      config.config as Record<string, unknown>,
      context.templateVars
    ) as unknown as S3BackendConfig;

    // Apply defaults
    const s3Config: S3BackendConfig = {
      encrypt: true, // Default: encryption enabled
      dynamodb_table: 'terraform-statelock', // Default: standard DynamoDB table name
      ...resolvedConfig,
    };

    // Build backend-config arguments
    const backendArgs: string[] = [];

    // Required fields
    backendArgs.push(`-backend-config=bucket=${s3Config.bucket}`);
    backendArgs.push(`-backend-config=key=${s3Config.key}`);

    // Optional fields
    if (s3Config.region) {
      backendArgs.push(`-backend-config=region=${s3Config.region}`);
    }

    if (s3Config.encrypt !== undefined) {
      backendArgs.push(`-backend-config=encrypt=${s3Config.encrypt}`);
    }

    if (s3Config.dynamodb_table) {
      backendArgs.push(`-backend-config=dynamodb_table=${s3Config.dynamodb_table}`);
    }

    if (s3Config.kms_key_id) {
      backendArgs.push(`-backend-config=kms_key_id=${s3Config.kms_key_id}`);
    }

    // AWS credential options (optional)
    if (s3Config.profile) {
      backendArgs.push(`-backend-config=profile=${s3Config.profile}`);
    }

    if (s3Config.role_arn) {
      backendArgs.push(`-backend-config=role_arn=${s3Config.role_arn}`);
    }

    if (s3Config.session_name) {
      backendArgs.push(`-backend-config=session_name=${s3Config.session_name}`);
    }

    if (s3Config.external_id) {
      backendArgs.push(`-backend-config=external_id=${s3Config.external_id}`);
    }

    if (s3Config.assume_role_duration_seconds) {
      backendArgs.push(
        `-backend-config=assume_role_duration_seconds=${s3Config.assume_role_duration_seconds}`
      );
    }

    // Advanced options (optional)
    if (s3Config.access_key) {
      backendArgs.push(`-backend-config=access_key=${s3Config.access_key}`);
    }

    if (s3Config.secret_key) {
      backendArgs.push(`-backend-config=secret_key=${s3Config.secret_key}`);
    }

    if (s3Config.token) {
      backendArgs.push(`-backend-config=token=${s3Config.token}`);
    }

    if (s3Config.iam_endpoint) {
      backendArgs.push(`-backend-config=iam_endpoint=${s3Config.iam_endpoint}`);
    }

    if (s3Config.max_retries !== undefined) {
      backendArgs.push(`-backend-config=max_retries=${s3Config.max_retries}`);
    }

    if (s3Config.sse_customer_key) {
      backendArgs.push(`-backend-config=sse_customer_key=${s3Config.sse_customer_key}`);
    }

    if (s3Config.skip_credentials_validation !== undefined) {
      backendArgs.push(
        `-backend-config=skip_credentials_validation=${s3Config.skip_credentials_validation}`
      );
    }

    if (s3Config.skip_metadata_api_check !== undefined) {
      backendArgs.push(
        `-backend-config=skip_metadata_api_check=${s3Config.skip_metadata_api_check}`
      );
    }

    if (s3Config.skip_region_validation !== undefined) {
      backendArgs.push(`-backend-config=skip_region_validation=${s3Config.skip_region_validation}`);
    }

    if (s3Config.force_path_style !== undefined) {
      backendArgs.push(`-backend-config=force_path_style=${s3Config.force_path_style}`);
    }

    return backendArgs;
  },

  /**
   * Optional setup hook to verify bucket exists
   * @param config - Backend configuration
   * @param context - Execution context
   */
  setup: async (config: BackendConfig, context: ExecutionContext): Promise<void> => {
    // Resolve template variables in config
    const resolvedConfig = TemplateUtils.resolveObject(
      config.config as Record<string, unknown>,
      context.templateVars
    ) as unknown as S3BackendConfig;

    const bucket = resolvedConfig.bucket;
    if (!bucket) {
      return; // Validation will catch this
    }

    try {
      // Try to check if bucket exists using AWS CLI
      // This is optional, so we'll just log if it fails
      const { execSync } = await import('child_process');
      execSync(`aws s3api head-bucket --bucket ${bucket}`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      Logger.debug(`✅ S3 bucket ${bucket} exists and is accessible`);
    } catch (error) {
      // Bucket might not exist or we might not have permissions
      // This is not fatal - terraform init will handle it
      Logger.debug(
        `Could not verify S3 bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};
