/**
 * Init command handler
 * Scaffolds a new infrastructure project with opinionated defaults
 */

import { resolve } from 'path';
import { Logger } from '../utils/logger';
import { ConfigError } from '../core/errors';
import {
  validateProjectName,
  validateProvider,
  validateLanguage,
  isDirectoryEmpty,
  createProjectStructure,
  generateTerraformFiles,
  generateApplicationFiles,
  generateConfigFiles,
} from '../utils/scaffolding';

/**
 * Init command options
 */
export interface InitOptions {
  provider?: string;
  language?: string;
  workingDir?: string;
  force?: boolean;
}

/**
 * Init command handler for project scaffolding
 *
 * @example
 * ```typescript
 * // Create AWS project with JavaScript
 * await InitCommand.execute('my-project', {
 *   provider: 'aws',
 *   language: 'javascript'
 * });
 *
 * // Create Azure project with TypeScript
 * await InitCommand.execute('my-project', {
 *   provider: 'azure',
 *   language: 'typescript'
 * });
 * ```
 */
export class InitCommand {
  /**
   * Execute the init command to scaffold a new infrastructure project
   *
   * Creates a complete project structure with:
   * - Terraform configuration files for the specified cloud provider
   * - Application code templates in the specified language
   * - Pre-configured `.tfwconfig.yml` with backend settings
   * - Example `.env.example` file
   * - Complete `.gitignore` and `README.md`
   *
   * @param projectName - Name of the project to create (optional, defaults to current directory)
   * @param options - Init command options
   * @param options.provider - Cloud provider: 'aws', 'azure', or 'gcp' (default: 'aws')
   * @param options.language - Application language: 'javascript', 'typescript', 'python', or 'go' (default: 'javascript')
   * @param options.workingDir - Directory where to create the project (default: current directory)
   * @param options.force - Overwrite existing files if present (default: false)
   * @throws {ConfigError} If validation fails (invalid project name, provider, language, or non-empty directory)
   *
   * @example
   * ```typescript
   * // Create project in current directory
   * await InitCommand.execute(undefined, { provider: 'aws' });
   *
   * // Create named project
   * await InitCommand.execute('my-infrastructure', {
   *   provider: 'gcp',
   *   language: 'python'
   * });
   *
   * // Force overwrite existing files
   * await InitCommand.execute('my-project', { force: true });
   * ```
   */
  static async execute(projectName: string | undefined, options: InitOptions = {}): Promise<void> {
    const provider = options.provider || 'aws';
    const language = options.language || 'javascript';
    const workingDir = options.workingDir || process.cwd();
    const force = options.force || false;

    // Validate provider
    if (!validateProvider(provider)) {
      throw new ConfigError(
        `Invalid provider "${provider}". Must be one of: aws, azure, gcp.\n` +
          `Example: terraflow init my-project --provider aws`
      );
    }

    // Validate language
    if (!validateLanguage(language)) {
      throw new ConfigError(
        `Invalid language "${language}". Must be one of: javascript, typescript, python, go.\n` +
          `Example: terraflow init my-project --language typescript`
      );
    }

    // Determine project directory
    const projectDir = projectName ? resolve(workingDir, projectName) : resolve(workingDir);

    // Validate project name if provided
    if (projectName && !validateProjectName(projectName)) {
      throw new ConfigError(
        `Invalid project name "${projectName}". Project name must contain only alphanumeric characters, hyphens, and underscores.\n` +
          `Valid examples: "my-project", "my_project", "project123"\n` +
          `Invalid examples: "my project" (spaces), "my.project" (dots), "my/project" (slashes)`
      );
    }

    // Check if directory exists and is not empty
    const isEmpty = await isDirectoryEmpty(projectDir);
    if (!isEmpty && !force) {
      throw new ConfigError(
        `Directory "${projectDir}" is not empty. Use --force to overwrite existing files.\n` +
          `Warning: Using --force will overwrite existing files in the target directory.\n` +
          `Example: terraflow init ${projectName || 'my-project'} --force`
      );
    }

    Logger.info(`🚀 Initializing project "${projectName || 'current directory'}"...`);
    Logger.info(`   Provider: ${provider}`);
    Logger.info(`   Language: ${language}`);

    // Create project structure
    await createProjectStructure(projectDir);

    // Generate files
    const finalProjectName = projectName || 'project';
    await generateTerraformFiles(projectDir, provider, finalProjectName);
    await generateApplicationFiles(projectDir, language, finalProjectName);
    await generateConfigFiles(projectDir, provider, language, finalProjectName);

    Logger.info(`✅ Project "${projectName || 'current directory'}" initialized successfully!`);
    Logger.info('');
    Logger.info('Next steps:');
    if (projectName) {
      Logger.info(`  1. cd ${projectName}`);
      Logger.info('  2. cp .env.example .env');
    } else {
      Logger.info('  1. cp .env.example .env');
      Logger.info('  2. Edit .env with your credentials');
    }
    if (projectName) {
      Logger.info('  3. Edit .env with your credentials');
      Logger.info('  4. Review and update .tfwconfig.yml');
      Logger.info('  5. terraflow init');
      Logger.info('  6. terraflow plan');
    } else {
      Logger.info('  3. Review and update .tfwconfig.yml');
      Logger.info('  4. terraflow init');
      Logger.info('  5. terraflow plan');
    }
    Logger.info('');
    Logger.info('Documentation: ./README.md');
  }
}
