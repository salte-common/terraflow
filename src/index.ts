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
import { TerraformExecutor } from './core/terraform';
import { ConfigCommand } from './commands/config';
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
    .description('Show resolved configuration with source tracking and masked sensitive values')
    .action(async () => {
      try {
        const opts = program.opts<CliOptions>();
        await ConfigCommand.show(opts);
      } catch (error) {
        process.exit(1);
      }
    });

  configCommand
    .command('init')
    .description(
      'Generate skeleton config file with examples for all backend types, secrets providers, and auth configurations'
    )
    .option(
      '-o, --output <file>',
      'Output file path (default: .tfwconfig.yml in working directory)'
    )
    .action(async (options: { output?: string }) => {
      try {
        await ConfigCommand.init(options.output);
      } catch (error) {
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

  // Validations are now run inside TerraformExecutor.execute()
  // along with environment setup and plugin execution

  // Execute terraform command
  try {
    const terraformCommand = terraformArgs[0] || '';
    const terraformCommandArgs = terraformArgs.slice(1);

    await TerraformExecutor.execute(terraformCommand, terraformCommandArgs, config, context, {
      skipCommitCheck: opts.skipCommitCheck || config['skip-commit-check'] || false,
      dryRun: opts.dryRun || false,
    });
  } catch (error) {
    Logger.error(`Execution failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  Logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    Logger.debug(error.stack);
  }
  process.exit(1);
});
