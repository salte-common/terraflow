#!/usr/bin/env node

/**
 * Terraflow CLI - Main entry point
 * An opinionated Terraform workflow CLI with multi-cloud support
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigManager, type CliOptions } from './core/config';
import { ContextBuilder } from './core/context';
import { Validator } from './core/validator';
import { ValidationError } from './core/errors';
import { Logger } from './utils/logger';

const program = new Command();

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  // Load package.json for version
  let version = '1.0.0';
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    version = packageJson.version || '1.0.0';
  } catch {
    // Use default version if package.json can't be read
  }

  // Set up program
  program
    .name('terraflow')
    .description('Opinionated Terraform workflow CLI with multi-cloud support')
    .version(version, '-V, --version', 'Show version number')
    .allowExcessArguments(true) // Allow terraform arguments to pass through
    .passThroughOptions(); // Pass unknown options through to terraform

  // Global options
  program
    .option('-c, --config <path>', 'Path to config file (default: <working-dir>/.tfwconfig.yml)')
    .option('-w, --workspace <name>', 'Override workspace name')
    .option('-b, --backend <type>', 'Backend type: local|s3|azurerm|gcs (default: local)')
    .option(
      '-s, --secrets <type>',
      'Secrets provider: env|aws-secrets|azure-keyvault|gcp-secret-manager'
    )
    .option('--skip-commit-check', 'Skip git commit validation')
    .option('-d, --working-dir <path>', 'Terraform working directory (default: ./terraform)')
    .option('--assume-role <arn>', 'AWS role ARN to assume (AWS only)')
    .option('-v, --verbose', 'Verbose logging')
    .option('--debug', 'Debug logging (includes terraform debug output)')
    .option('--dry-run', 'Show what would be executed without running')
    .option('--no-color', 'Disable colored output');

  // Special config command
  const configCommand = program.command('config').description('Manage Terraflow configuration');

  configCommand
    .command('show')
    .description('Show resolved configuration')
    .action(async () => {
      try {
        const cliOptions = program.opts<CliOptions>();
        const config = await ConfigManager.load(cliOptions);
        console.log(JSON.stringify(config, null, 2));
      } catch (error) {
        Logger.error(
          `Failed to show configuration: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  configCommand
    .command('init')
    .description('Generate skeleton config file')
    .option('-o, --output <file>', 'Output file path (default: .tfwconfig.yml)')
    .action(async (options: { output?: string }) => {
      try {
        const outputPath = options.output || '.tfwconfig.yml';
        const skeleton = generateConfigSkeleton();
        const { writeFileSync } = await import('fs');
        writeFileSync(outputPath, skeleton, 'utf8');
        Logger.success(`Configuration skeleton created at ${outputPath}`);
      } catch (error) {
        Logger.error(
          `Failed to create config file: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  // Parse arguments
  program.parse();

  // Check if config command was executed (handle early to avoid loading config)
  const command = program.args[0];
  if (command === 'config') {
    // Config command handles its own execution, so we're done here
    return;
  }

  // Get parsed options
  const opts = program.opts<CliOptions>();

  // Configure logger
  if (opts.debug) {
    Logger.setLevel('debug');
  } else if (opts.verbose) {
    Logger.setLevel('info');
  } else {
    Logger.setLevel('info');
  }

  if (opts.noColor) {
    Logger.setColor(false);
  }

  // If no terraform command specified, show help
  const terraformArgs = program.args;
  if (terraformArgs.length === 0) {
    program.help();
    return;
  }

  // Load configuration
  let config;
  try {
    config = await ConfigManager.load(opts);
    Logger.debug('Configuration loaded successfully');
  } catch (error) {
    Logger.error(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Update logger level from config if set
  if (config.logging?.level) {
    Logger.setLevel(config.logging.level);
  }

  // Build execution context
  let context;
  try {
    context = await ContextBuilder.build(config);
    Logger.debug(`Execution context built for workspace: ${context.workspace}`);
  } catch (error) {
    Logger.error(
      `Failed to build execution context: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Extract terraform command (first argument)
  const terraformCommand = terraformArgs[0] || '';

  // Run validations
  try {
    const validationResult = await Validator.validate(terraformCommand, config, context, {
      skipCommitCheck: opts.skipCommitCheck || config['skip-commit-check'] || false,
      dryRun: opts.dryRun || false,
    });

    if (!validationResult.passed) {
      Logger.error('Validation failed:');
      for (const error of validationResult.errors) {
        Logger.error(`  - ${error}`);
      }
      if (validationResult.warnings.length > 0) {
        Logger.warn('Warnings:');
        for (const warning of validationResult.warnings) {
          Logger.warn(`  - ${warning}`);
        }
      }
      process.exit(1);
    }

    if (validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        Logger.warn(warning);
      }
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      Logger.error(`Validation error: ${error.message}`);
    } else {
      Logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  }

  // If dry-run, show what would be executed
  if (opts.dryRun) {
    Logger.info('🔍 DRY RUN MODE - Terraform command will not be executed');
    Logger.info(`Workspace:        ${context.workspace}`);
    Logger.info(`Working dir:      ${context.workingDir}`);
    Logger.info(`Backend:          ${config.backend?.type || 'local'}`);
    Logger.info(`Terraform args:   ${terraformArgs.join(' ')}`);
    return;
  }

  // TODO: Execute terraform command
  Logger.info(`🚀 Executing: terraform ${terraformArgs.join(' ')}`);
  Logger.warn('Terraform execution not yet implemented');
}

/**
 * Generate skeleton configuration file
 * @returns YAML configuration skeleton
 */
function generateConfigSkeleton(): string {
  return `# Terraflow Configuration
# See SPECIFICATION.md for complete documentation

# Global settings
workspace: development
working-dir: ./terraform
skip-commit-check: false

# Backend configuration
backend:
  type: local  # local | s3 | azurerm | gcs
  config:
    # S3-specific example
    # bucket: \${AWS_REGION}-\${AWS_ACCOUNT_ID}-terraform-state
    # key: \${GITHUB_REPOSITORY}
    # region: \${AWS_REGION}
    # dynamodb_table: terraform-statelock
    # encrypt: true

# Secrets management
secrets:
  provider: env  # env | aws-secrets | azure-keyvault | gcp-secret-manager
  config:
    # Provider-specific configuration

# Authentication
auth:
  # AWS assume role example
  # assume_role:
  #   role_arn: arn:aws:iam::123456789:role/TerraformRole
  #   session_name: terraflow-session
  #   duration: 3600

# Terraform variables
variables:
  # environment: production
  # instance_count: 3

# Workspace derivation strategy
workspace_strategy:
  - cli
  - env
  - tag
  - branch
  - hostname

# Validations
validations:
  require_git_commit: true
  allowed_workspaces: []  # Empty = allow all

# Logging
logging:
  level: info  # error | warn | info | debug
  terraform_log: false
  terraform_log_level: TRACE
`;
}

// Run main
main().catch((error) => {
  Logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    Logger.debug(error.stack);
  }
  process.exit(1);
});
