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
import { TerraformExecutor, WORKSPACE_SENSITIVE_COMMANDS } from './core/terraform';
import { ConfigCommand } from './commands/config';
import { NewCommand } from './commands/new';
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

  // Use Commander.js for all command routing
  await handleCommanderParsing(version);
}

/**
 * Handle Commander.js parsing for special commands (config, new) and help
 */
async function handleCommanderParsing(version: string): Promise<void> {
  // Set up program for special commands
  program
    .name('terraflow')
    .description(
      'Opinionated Terraform workflow CLI with multi-cloud support. Automatically runs terraform init and workspace selection for workspace-sensitive commands (plan, apply, destroy, etc.). All other terraform commands are passed through directly.'
    )
    .version(version, '-V, --version', 'Show version number')
    .enablePositionalOptions() // Required for passThroughOptions
    .allowExcessArguments(true) // Allow terraform arguments to pass through
    .passThroughOptions() // Pass unknown options through to terraform
    .addHelpText(
      'after',
      `
Examples:
  $ terraflow plan                    # Auto init + workspace, then terraform plan
  $ terraflow apply --auto-approve    # Auto init + workspace, then terraform apply
  $ terraflow init                    # Run terraform init (with backend config)
  $ terraflow fmt                     # Run terraform fmt (direct, no init)
  $ terraflow new my-project          # Scaffold a new project
  $ terraflow config show             # Show resolved configuration

Special Commands:
  new <project-name>    Scaffold a new infrastructure project
  config <subcommand>   Manage Terraflow configuration (show, init)

Note: Workspace-sensitive commands (plan, apply, destroy, etc.) automatically
run 'terraform init' and select/create the workspace before executing.
`
    );

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

  // New command for project scaffolding
  program
    .command('new [project-name]')
    .description('Scaffold a new infrastructure project with opinionated defaults')
    .option('-p, --provider <name>', 'Cloud provider: aws, azure, or gcp (default: aws)', 'aws')
    .option(
      '-l, --language <name>',
      'Application language: javascript, typescript, python, or go (default: javascript)',
      'javascript'
    )
    .option(
      '-d, --working-dir <path>',
      'Directory where to create the project (default: current directory)',
      process.cwd()
    )
    .option('-f, --force', 'Overwrite existing files if present (default: false)', false)
    .addHelpText(
      'after',
      `
Examples:
  $ terraflow new my-project
  $ terraflow new my-project --provider azure --language typescript
  $ terraflow new --provider gcp --language python
  $ terraflow new my-project --force
`
    )
    .action(
      async (
        projectName: string | undefined,
        options: { provider?: string; language?: string; workingDir?: string; force?: boolean }
      ) => {
        try {
          await NewCommand.execute(projectName, {
            provider: options.provider,
            language: options.language,
            workingDir: options.workingDir,
            force: options.force,
          });
        } catch (error) {
          Logger.error(
            `Failed to create project: ${error instanceof Error ? error.message : String(error)}`
          );
          process.exit(1);
        }
      }
    );

  // Register workspace-sensitive terraform commands
  // Exclude 'workspace' as it's for workspace management (list, show, select, etc.)
  // and shouldn't auto-select a workspace before running
  const commandsToRegister = WORKSPACE_SENSITIVE_COMMANDS.filter((cmd) => cmd !== 'workspace');
  for (const cmd of commandsToRegister) {
    program
      .command(cmd)
      .description(`Run terraform ${cmd} with automatic init and workspace selection`)
      .allowExcessArguments(true)
      .passThroughOptions()
      .action(async () => {
        // Get remaining arguments after the command
        // Commander.js may include the command name in program.args, so filter it out
        const terraformArgs = program.args.filter((arg) => arg !== cmd);
        await handleWorkspaceSensitiveCommand(cmd, terraformArgs);
      });
  }

  // Handle unknown commands - pass through directly to terraform (no init/workspace)
  program.on('command:*', async (operands) => {
    const unknownCommand = operands[0];
    await handleUnknownCommand(unknownCommand);
  });

  // Parse arguments with Commander.js
  await program.parseAsync();
}

/**
 * Handle workspace-sensitive terraform command (plan, apply, destroy, etc.)
 * These commands go through full workflow: init + workspace selection + terraform command
 */
async function handleWorkspaceSensitiveCommand(
  command: string,
  terraformArgs: string[] = []
): Promise<void> {
  const opts = program.opts<CliOptions>();
  // terraformArgs are passed from the action callback, already excluding the command name

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

  // Load configuration
  let configResult;
  try {
    configResult = await ConfigManager.load(opts);
  } catch (error) {
    Logger.error(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
    return;
  }
  const { config, configFileDir } = configResult;

  // Build execution context
  let context;
  try {
    context = await ContextBuilder.build(config);
  } catch (error) {
    Logger.error(
      `Failed to build execution context: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
    return;
  }

  // Execute through TerraformExecutor (handles init + workspace + command)
  try {
    await TerraformExecutor.execute(command, terraformArgs, config, context, {
      skipCommitCheck: opts.skipCommitCheck,
      dryRun: opts.dryRun,
      configFileDir,
    });
  } catch (error) {
    // Check if this is a user cancellation from TerraformExecutor
    // TerraformExecutor handles cancellation for interactive commands (apply, plan, destroy)
    const exitCode = (error as { status?: number }).status;
    const isInteractiveCommand = ['apply', 'plan', 'destroy'].includes(command);

    if (isInteractiveCommand && exitCode === 1) {
      // User cancellation - already handled, just exit
      process.exit(1);
      return;
    }

    // For actual errors, log and exit
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.error(`Terraform execution failed: ${errorMessage}`);
    process.exit(1);
    return;
  }
}

/**
 * Handle unknown terraform command - pass through directly to terraform (no init/workspace)
 * This allows any terraform command to work without needing to be explicitly registered
 */
async function handleUnknownCommand(command: string): Promise<void> {
  const opts = program.opts<CliOptions>();
  // Get remaining arguments after the unknown command
  // program.args contains the command name and remaining args, so skip the first element
  const terraformArgs = program.args.slice(1);

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

  // Load configuration (for working dir and other settings)
  let configResult;
  try {
    configResult = await ConfigManager.load(opts);
  } catch (error) {
    Logger.error(
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
    return;
  }
  const { config } = configResult;

  // Minimal validation - just check terraform is installed
  try {
    const { Validator } = await import('./core/validator');
    await Validator.validateTerraformInstalled();
  } catch (error) {
    Logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
    return;
  }

  // Get working directory from config
  const workingDir = ConfigManager.getWorkingDir(config, process.cwd());

  // Execute terraform command directly (no init, no workspace setup)
  try {
    await TerraformExecutor.runCommand(command, terraformArgs, workingDir);
  } catch (error) {
    Logger.error(
      `Terraform command failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
    return;
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
