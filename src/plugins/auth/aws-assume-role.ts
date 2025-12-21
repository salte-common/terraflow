/**
 * AWS assume role auth plugin
 * Assumes an AWS IAM role and returns temporary credentials
 */

import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import type { AuthPlugin, AuthConfig, ExecutionContext } from '../../types';
import { ConfigError } from '../../core/errors';
import { Logger } from '../../utils/logger';

/**
 * AWS IAM Role ARN format validation
 * Format: arn:aws:iam::[0-9]{12}:role/[a-zA-Z0-9+=,.@_-]+
 */
const IAM_ROLE_ARN_REGEX = /^arn:aws:iam::\d{12}:role\/[a-zA-Z0-9+=,.@_-]+$/;

/**
 * AWS assume role authentication plugin
 */
export const awsAssumeRole: AuthPlugin = {
  name: 'aws-assume-role',

  /**
   * Validate AWS assume role configuration
   * @param config - Auth configuration
   * @throws {ConfigError} If configuration is invalid
   */
  validate: async (config: AuthConfig): Promise<void> => {
    if (!config.assume_role) {
      throw new ConfigError('AWS assume role configuration is required');
    }

    const assumeRoleConfig = config.assume_role;

    // role_arn is required
    if (!assumeRoleConfig.role_arn) {
      throw new ConfigError('AWS assume role requires "role_arn" configuration');
    }

    // Validate role_arn format
    if (!IAM_ROLE_ARN_REGEX.test(assumeRoleConfig.role_arn)) {
      throw new ConfigError(
        `Invalid role_arn format: ${assumeRoleConfig.role_arn}. Expected format: arn:aws:iam::123456789012:role/RoleName`
      );
    }

    // Validate duration if provided (must be between 900 and 43200 seconds)
    if (assumeRoleConfig.duration !== undefined) {
      if (assumeRoleConfig.duration < 900 || assumeRoleConfig.duration > 43200) {
        throw new ConfigError(
          `Invalid duration: ${assumeRoleConfig.duration}. Duration must be between 900 and 43200 seconds (15 minutes to 12 hours)`
        );
      }
    }
  },

  /**
   * Authenticate by assuming an AWS IAM role
   * Returns temporary credentials as environment variables
   * @param config - Auth configuration
   * @param context - Execution context
   * @returns Temporary credentials as environment variables
   */
  authenticate: async (
    config: AuthConfig,
    context: ExecutionContext
  ): Promise<Record<string, string>> => {
    if (!config.assume_role) {
      throw new ConfigError('AWS assume role configuration is required');
    }

    const assumeRoleConfig = config.assume_role;
    const roleArn = assumeRoleConfig.role_arn;
    const sessionName = assumeRoleConfig.session_name || 'terraflow-session';
    const durationSeconds = assumeRoleConfig.duration || 3600;

    try {
      Logger.debug(`Assuming AWS IAM role: ${roleArn}`);

      // Create STS client
      const stsClient = new STSClient({
        region: context.cloud.awsRegion || process.env.AWS_REGION || 'us-east-1',
      });

      // Call AssumeRole
      const command = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: durationSeconds,
      });

      const response = await stsClient.send(command);

      if (!response.Credentials) {
        throw new Error('AssumeRole response did not contain credentials');
      }

      const credentials = response.Credentials;

      // Return credentials as environment variables
      const envVars: Record<string, string> = {
        AWS_ACCESS_KEY_ID: credentials.AccessKeyId || '',
        AWS_SECRET_ACCESS_KEY: credentials.SecretAccessKey || '',
        AWS_SESSION_TOKEN: credentials.SessionToken || '',
      };

      // Set expiration time if available (optional, for information)
      if (credentials.Expiration) {
        Logger.debug(`Credentials expire at: ${credentials.Expiration.toISOString()}`);
      }

      Logger.info(`✅ Successfully assumed role: ${roleArn}`);

      return envVars;
    } catch (error) {
      // Handle specific AWS errors
      if (error instanceof Error) {
        if (error.name === 'AccessDenied' || error.message.includes('AccessDenied')) {
          throw new ConfigError(
            `Access denied when assuming role ${roleArn}. Ensure your AWS credentials have permission to assume this role.`
          );
        }

        if (error.message.includes('NoSuchEntity')) {
          throw new ConfigError(`Role ${roleArn} does not exist.`);
        }

        if (error.message.includes('MalformedPolicyDocument')) {
          throw new ConfigError(
            `Invalid role configuration for ${roleArn}. Check the role's trust policy.`
          );
        }

        // Generic error handling
        throw new ConfigError(
          `Failed to assume role ${roleArn}: ${error.message}. Ensure you have valid AWS credentials and permissions.`
        );
      }

      throw new ConfigError(`Failed to assume role ${roleArn}: ${String(error)}`);
    }
  },
};
