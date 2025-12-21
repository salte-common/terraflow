/**
 * Configuration manager
 * Loads and merges configuration from multiple sources
 * Hierarchy: CLI > Env > Config File > Computed Defaults > Hard-coded Defaults
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { TerraflowConfig } from '../types/config';
import { Logger } from '../utils/logger';

export interface CliOptions {
  config?: string;
  workspace?: string;
  backend?: string;
  secrets?: string;
  skipCommitCheck?: boolean;
  workingDir?: string;
  assumeRole?: string;
  verbose?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  noColor?: boolean;
}

/**
 * Configuration manager for Terraflow
 * Handles loading and merging configuration from multiple sources
 */
export class ConfigManager {
  /**
   * Load and merge configuration from CLI args, env vars, and config file
   * @param cliOptions - Command line options
   * @param cwd - Current working directory
   * @returns Merged configuration
   */
  static async load(
    cliOptions: CliOptions = {},
    cwd: string = process.cwd()
  ): Promise<TerraflowConfig> {
    // Start with hard-coded defaults (lowest priority)
    const defaults: TerraflowConfig = {
      workspace: undefined,
      'working-dir': './terraform',
      'skip-commit-check': false,
      backend: {
        type: 'local',
      },
      logging: {
        level: 'info',
        terraform_log: false,
        terraform_log_level: 'TRACE',
      },
    };

    // Load config file (higher priority than defaults)
    const configFile = ConfigManager.getConfigFilePath(cliOptions, cwd);
    const fileConfig = ConfigManager.loadConfigFile(configFile);

    // Load environment variables (higher priority than config file)
    const envConfig = ConfigManager.loadFromEnvironment();

    // Merge: defaults < fileConfig < envConfig < cliOptions
    const merged = ConfigManager.mergeConfigs(
      defaults,
      fileConfig,
      envConfig,
      ConfigManager.cliOptionsToConfig(cliOptions)
    );

    return merged;
  }

  /**
   * Get the config file path
   * @param cliOptions - CLI options
   * @param cwd - Current working directory
   * @returns Path to config file
   */
  private static getConfigFilePath(cliOptions: CliOptions, cwd: string): string {
    if (cliOptions.config) {
      return path.isAbsolute(cliOptions.config)
        ? cliOptions.config
        : path.join(cwd, cliOptions.config);
    }

    const envConfig = process.env.TERRAFLOW_CONFIG;
    if (envConfig) {
      return path.isAbsolute(envConfig) ? envConfig : path.join(cwd, envConfig);
    }

    // Default: .tfwconfig.yml in working directory
    return path.join(cwd, '.tfwconfig.yml');
  }

  /**
   * Load configuration from file
   * @param configPath - Path to config file
   * @returns Configuration object or empty object if file doesn't exist
   */
  private static loadConfigFile(configPath: string): TerraflowConfig {
    if (!fs.existsSync(configPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(content) as TerraflowConfig;
      Logger.debug(`Loaded configuration from ${configPath}`);
      return config || {};
    } catch (error) {
      Logger.warn(
        `Failed to load config file ${configPath}: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  /**
   * Load configuration from environment variables
   * @returns Configuration from environment
   */
  private static loadFromEnvironment(): TerraflowConfig {
    const envConfig: TerraflowConfig = {};

    if (process.env.TERRAFLOW_WORKSPACE) {
      envConfig.workspace = process.env.TERRAFLOW_WORKSPACE;
    }

    if (process.env.TERRAFLOW_WORKING_DIR) {
      envConfig['working-dir'] = process.env.TERRAFLOW_WORKING_DIR;
    }

    if (process.env.TERRAFLOW_SKIP_COMMIT_CHECK) {
      envConfig['skip-commit-check'] = ConfigManager.parseBoolean(
        process.env.TERRAFLOW_SKIP_COMMIT_CHECK
      );
    }

    if (process.env.TERRAFLOW_BACKEND) {
      envConfig.backend = {
        type: process.env.TERRAFLOW_BACKEND,
      };
    }

    if (process.env.TERRAFLOW_SECRETS) {
      envConfig.secrets = {
        provider: process.env.TERRAFLOW_SECRETS,
      };
    }

    if (process.env.TERRAFLOW_ASSUME_ROLE) {
      envConfig.auth = {
        assume_role: {
          role_arn: process.env.TERRAFLOW_ASSUME_ROLE,
        },
      };
    }

    return envConfig;
  }

  /**
   * Convert CLI options to configuration format
   * @param cliOptions - CLI options
   * @returns Configuration object
   */
  private static cliOptionsToConfig(cliOptions: CliOptions): TerraflowConfig {
    const config: TerraflowConfig = {};

    if (cliOptions.workspace !== undefined) {
      config.workspace = cliOptions.workspace;
    }

    if (cliOptions.workingDir !== undefined) {
      config['working-dir'] = cliOptions.workingDir;
    }

    if (cliOptions.skipCommitCheck !== undefined) {
      config['skip-commit-check'] = cliOptions.skipCommitCheck;
    }

    if (cliOptions.backend !== undefined) {
      config.backend = {
        type: cliOptions.backend,
      };
    }

    if (cliOptions.secrets !== undefined) {
      config.secrets = {
        provider: cliOptions.secrets,
      };
    }

    if (cliOptions.assumeRole !== undefined) {
      config.auth = {
        assume_role: {
          role_arn: cliOptions.assumeRole,
        },
      };
    }

    if (cliOptions.verbose || cliOptions.debug) {
      config.logging = {
        level: cliOptions.debug ? 'debug' : 'info',
      };
    }

    if (cliOptions.noColor !== undefined) {
      // no-color is handled by Logger, not config
    }

    return config;
  }

  /**
   * Parse boolean from string
   * @param value - String value to parse
   * @returns Boolean value
   */
  private static parseBoolean(value: string): boolean {
    const normalized = value.toLowerCase().trim();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  /**
   * Deep merge configuration objects
   * Later objects override earlier ones
   * @param configs - Configuration objects to merge (in priority order)
   * @returns Merged configuration
   */
  private static mergeConfigs(...configs: TerraflowConfig[]): TerraflowConfig {
    const result: TerraflowConfig = {};

    for (const config of configs) {
      if (!config || typeof config !== 'object') {
        continue;
      }

      // Merge workspace
      if (config.workspace !== undefined) {
        result.workspace = config.workspace;
      }

      // Merge working-dir
      if (config['working-dir'] !== undefined) {
        result['working-dir'] = config['working-dir'];
      }

      // Merge skip-commit-check
      if (config['skip-commit-check'] !== undefined) {
        result['skip-commit-check'] = config['skip-commit-check'];
      }

      // Merge backend
      if (config.backend) {
        result.backend = {
          ...(result.backend || {}),
          ...config.backend,
          config: {
            ...(result.backend?.config || {}),
            ...(config.backend.config || {}),
          },
        };
      }

      // Merge secrets
      if (config.secrets) {
        result.secrets = {
          ...(result.secrets || {}),
          ...config.secrets,
          config: {
            ...(result.secrets?.config || {}),
            ...(config.secrets.config || {}),
          },
        };
      }

      // Merge auth
      if (config.auth) {
        result.auth = {
          ...(result.auth || {}),
          ...config.auth,
          assume_role: config.auth.assume_role
            ? {
                ...(result.auth?.assume_role || {}),
                ...config.auth.assume_role,
              }
            : result.auth?.assume_role,
          service_principal: config.auth.service_principal
            ? {
                ...(result.auth?.service_principal || {}),
                ...config.auth.service_principal,
              }
            : result.auth?.service_principal,
          service_account: config.auth.service_account
            ? {
                ...(result.auth?.service_account || {}),
                ...config.auth.service_account,
              }
            : result.auth?.service_account,
        };
      }

      // Merge variables
      if (config.variables) {
        result.variables = {
          ...(result.variables || {}),
          ...config.variables,
        };
      }

      // Merge validations
      if (config.validations) {
        result.validations = {
          ...(result.validations || {}),
          ...config.validations,
        };
      }

      // Merge logging
      if (config.logging) {
        result.logging = {
          ...(result.logging || {}),
          ...config.logging,
        };
      }

      // Merge workspace_strategy
      if (config.workspace_strategy) {
        result.workspace_strategy = config.workspace_strategy;
      }
    }

    return result;
  }

  /**
   * Get resolved workspace name from configuration
   * @param config - Configuration object
   * @returns Workspace name or undefined
   */
  static getWorkspace(config: TerraflowConfig): string | undefined {
    return config.workspace;
  }

  /**
   * Get working directory path
   * @param config - Configuration object
   * @param cwd - Current working directory
   * @returns Absolute path to working directory
   */
  static getWorkingDir(config: TerraflowConfig, cwd: string = process.cwd()): string {
    const workingDir = config['working-dir'] || './terraform';
    return path.isAbsolute(workingDir) ? workingDir : path.join(cwd, workingDir);
  }
}
