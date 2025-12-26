/**
 * Scaffolding utilities for project initialization
 * Handles template processing and file generation
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger';
import { ConfigError } from '../core/errors';

/**
 * Template processing functions
 */

/**
 * Load a template file from the templates directory
 * @param templatePath - Path to template file relative to templates directory
 * @returns Template content as string
 */
export function loadTemplate(templatePath: string): string {
  // Get template directory (works in both source and built code)
  const templatesDir = join(__dirname, '..', 'templates');

  // Prevent path traversal attacks
  // Reject any path that contains path traversal sequences
  if (templatePath.includes('..') || templatePath.includes('~')) {
    throw new ConfigError(`Invalid template path: ${templatePath}`);
  }

  // Join and resolve to get absolute path, then verify it's within templates directory
  const fullPath = join(templatesDir, templatePath);

  // Additional safety: verify the resolved path is within templates directory
  // by checking that it starts with the templates directory path
  if (!fullPath.startsWith(templatesDir)) {
    throw new ConfigError(`Invalid template path: ${templatePath}`);
  }

  try {
    return readFileSync(fullPath, 'utf8');
  } catch (error) {
    Logger.error(
      `Failed to load template ${templatePath}: ${error instanceof Error ? error.message : String(error)}`
    );
    throw new ConfigError(
      `Template file not found: ${templatePath}.\n` +
        `This may indicate a corrupted installation. Try reinstalling terraflow.`
    );
  }
}

/**
 * Process a template string by replacing variable placeholders
 * @param template - Template content with placeholders
 * @param variables - Object mapping variable names to values
 * @returns Processed template with variables replaced
 */
export function processTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`<${key}>`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * File generation functions
 */

/**
 * Generate Terraform files for the project
 * @param projectDir - Root directory of the project
 * @param provider - Cloud provider (aws, azure, gcp)
 * @param projectName - Name of the project
 */
export async function generateTerraformFiles(
  projectDir: string,
  provider: string,
  projectName: string
): Promise<void> {
  const terraformDir = join(projectDir, 'terraform');
  const templatesDir = 'terraform';

  Logger.debug(`Generating Terraform files for provider: ${provider}`);

  // Create terraform directory if it doesn't exist
  mkdirSync(terraformDir, { recursive: true });

  // _init.tf - provider-specific
  const initTemplate = loadTemplate(join(templatesDir, provider, '_init.tf.template'));
  writeFileSync(join(terraformDir, '_init.tf'), initTemplate);

  // inputs.tf - provider-specific
  const inputsTemplate = loadTemplate(join(templatesDir, provider, 'inputs.tf.template'));
  writeFileSync(join(terraformDir, 'inputs.tf'), inputsTemplate);

  // locals.tf - common with project name replacement
  const localsTemplate = loadTemplate(join(templatesDir, 'locals.tf.template'));
  const localsContent = processTemplate(localsTemplate, { 'project-name': projectName });
  writeFileSync(join(terraformDir, 'locals.tf'), localsContent);

  // main.tf - common
  const mainTemplate = loadTemplate(join(templatesDir, 'main.tf.template'));
  writeFileSync(join(terraformDir, 'main.tf'), mainTemplate);

  // outputs.tf - common
  const outputsTemplate = loadTemplate(join(templatesDir, 'outputs.tf.template'));
  writeFileSync(join(terraformDir, 'outputs.tf'), outputsTemplate);

  // Create modules directory
  const modulesDir = join(terraformDir, 'modules');
  mkdirSync(modulesDir, { recursive: true });

  // modules/inputs.tf
  const moduleInputsTemplate = loadTemplate(join(templatesDir, 'modules', 'inputs.tf.template'));
  writeFileSync(join(modulesDir, 'inputs.tf'), moduleInputsTemplate);

  // modules/main.tf
  const moduleMainTemplate = loadTemplate(join(templatesDir, 'modules', 'main.tf.template'));
  writeFileSync(join(modulesDir, 'main.tf'), moduleMainTemplate);

  // modules/outputs.tf
  const moduleOutputsTemplate = loadTemplate(join(templatesDir, 'modules', 'outputs.tf.template'));
  writeFileSync(join(modulesDir, 'outputs.tf'), moduleOutputsTemplate);

  Logger.debug('Terraform files generated successfully');
}

/**
 * Get file extension for main file based on language
 * @param language - Programming language (javascript, typescript, python, go)
 * @returns File extension (e.g., '.js', '.ts', '.py', '.go')
 * @example
 * getMainExtension('typescript') // returns '.ts'
 * getMainExtension('python') // returns '.py'
 */
function getMainExtension(language: string): string {
  switch (language) {
    case 'typescript':
      return '.ts';
    case 'python':
      return '.py';
    case 'go':
      return '.go';
    default:
      return '.js';
  }
}

/**
 * Get test file name based on language
 * @param language - Programming language (javascript, typescript, python, go)
 * @returns Test file name (e.g., 'index.spec.js', 'test_main.py', 'main_test.go')
 * @example
 * getTestFileName('python') // returns 'test_main.py'
 * getTestFileName('go') // returns 'main_test.go'
 */
function getTestFileName(language: string): string {
  switch (language) {
    case 'python':
      return 'test_main.py';
    case 'go':
      return 'main_test.go';
    case 'typescript':
      return 'index.spec.ts';
    default:
      return 'index.spec.js';
  }
}

/**
 * Generate application files for the project
 * @param projectDir - Root directory of the project
 * @param language - Programming language (javascript, typescript, python, go)
 * @param projectName - Name of the project
 */
export async function generateApplicationFiles(
  projectDir: string,
  language: string,
  projectName: string
): Promise<void> {
  const srcDir = join(projectDir, 'src');
  const templatesDir = 'application';

  Logger.debug(`Generating application files for language: ${language}`);

  // Create src directories
  mkdirSync(join(srcDir, 'main'), { recursive: true });
  mkdirSync(join(srcDir, 'test'), { recursive: true });

  // Main file
  const mainTemplate = loadTemplate(join(templatesDir, language, 'main.template'));
  const mainContent = processTemplate(mainTemplate, { 'project-name': projectName });
  const mainExt = getMainExtension(language);
  writeFileSync(join(srcDir, 'main', `index${mainExt}`), mainContent);

  // Test file
  const testTemplate = loadTemplate(join(templatesDir, language, 'test.template'));
  const testContent = processTemplate(testTemplate, { 'project-name': projectName });
  const testFileName = getTestFileName(language);
  writeFileSync(join(srcDir, 'test', testFileName), testContent);

  // Language-specific config files
  if (language === 'typescript') {
    const tsconfigTemplate = loadTemplate(join(templatesDir, language, 'tsconfig.json.template'));
    writeFileSync(join(projectDir, 'tsconfig.json'), tsconfigTemplate);
  } else if (language === 'python') {
    const requirementsTemplate = loadTemplate(
      join(templatesDir, language, 'requirements.txt.template')
    );
    writeFileSync(join(projectDir, 'requirements.txt'), requirementsTemplate);
  } else if (language === 'go') {
    const goModTemplate = loadTemplate(join(templatesDir, language, 'go.mod.template'));
    const goModContent = processTemplate(goModTemplate, { 'project-name': projectName });
    writeFileSync(join(projectDir, 'go.mod'), goModContent);
  }

  Logger.debug('Application files generated successfully');
}

/**
 * Map cloud provider to Terraform backend type
 * @param provider - Cloud provider name (aws, azure, gcp)
 * @returns Backend type (s3, azurerm, gcs, or local)
 * @example
 * getBackendType('aws') // returns 's3'
 * getBackendType('azure') // returns 'azurerm'
 * getBackendType('gcp') // returns 'gcs'
 */
function getBackendType(provider: string): string {
  switch (provider) {
    case 'aws':
      return 's3';
    case 'azure':
      return 'azurerm';
    case 'gcp':
      return 'gcs';
    default:
      return 'local';
  }
}

/**
 * Generate configuration files for the project
 * @param projectDir - Root directory of the project
 * @param provider - Cloud provider (aws, azure, gcp)
 * @param language - Programming language (javascript, typescript, python, go)
 * @param projectName - Name of the project
 */
export async function generateConfigFiles(
  projectDir: string,
  provider: string,
  language: string,
  projectName: string
): Promise<void> {
  const templatesDir = 'config';

  Logger.debug(`Generating configuration files for provider: ${provider}, language: ${language}`);

  // .tfwconfig.yml
  const tfwconfigTemplate = loadTemplate(join(templatesDir, 'tfwconfig.yml.template'));
  const backendType = getBackendType(provider);
  const tfwconfigContent = processTemplate(tfwconfigTemplate, {
    'project-name': projectName,
    provider: backendType,
  });
  writeFileSync(join(projectDir, '.tfwconfig.yml'), tfwconfigContent);

  // .env.example
  const envExampleTemplate = loadTemplate(join(templatesDir, 'env.example.template'));
  writeFileSync(join(projectDir, '.env.example'), envExampleTemplate);

  // .gitignore
  const gitignoreTemplate = loadTemplate(join(templatesDir, 'gitignore.template'));
  // gitignore template already includes all languages, no processing needed
  writeFileSync(join(projectDir, '.gitignore'), gitignoreTemplate);

  // README.md
  const readmeTemplate = loadTemplate(join(templatesDir, 'README.md.template'));
  const readmeContent = processTemplate(readmeTemplate, {
    'project-name': projectName,
    provider: provider, // Use original provider name for README
  });
  writeFileSync(join(projectDir, 'README.md'), readmeContent);

  Logger.debug('Configuration files generated successfully');
}

/**
 * Project structure creation
 */

/**
 * Create the complete project directory structure
 * @param projectDir - Root directory of the project
 */
export async function createProjectStructure(projectDir: string): Promise<void> {
  Logger.debug(`Creating project structure in: ${projectDir}`);

  const dirs = [
    join(projectDir, 'src', 'main'),
    join(projectDir, 'src', 'test'),
    join(projectDir, 'terraform', 'modules'),
  ];

  for (const dir of dirs) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      Logger.error(
        `Failed to create directory ${dir}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new ConfigError(`Failed to create directory: ${dir}`);
    }
  }

  Logger.debug('Project structure created successfully');
}

/**
 * Validation helpers
 */

/**
 * Validate project name format
 * @param name - Project name to validate
 * @returns true if valid, false otherwise
 */
export function validateProjectName(name: string): boolean {
  const PROJECT_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
  return PROJECT_NAME_REGEX.test(name);
}

/**
 * Validate cloud provider
 * @param provider - Provider name to validate
 * @returns true if valid, false otherwise
 */
export function validateProvider(provider: string): boolean {
  const VALID_PROVIDERS = ['aws', 'azure', 'gcp'];
  return VALID_PROVIDERS.includes(provider);
}

/**
 * Validate programming language
 * @param language - Language name to validate
 * @returns true if valid, false otherwise
 */
export function validateLanguage(language: string): boolean {
  const VALID_LANGUAGES = ['javascript', 'typescript', 'python', 'go'];
  return VALID_LANGUAGES.includes(language);
}

/**
 * Check if a directory is empty
 * @param dir - Directory path to check
 * @returns true if directory is empty or doesn't exist, false otherwise
 */
export async function isDirectoryEmpty(dir: string): Promise<boolean> {
  if (!existsSync(dir)) {
    return true;
  }

  try {
    const files = readdirSync(dir);
    return files.length === 0;
  } catch (error) {
    Logger.error(
      `Failed to read directory ${dir}: ${error instanceof Error ? error.message : String(error)}`
    );
    throw new ConfigError(`Failed to read directory: ${dir}`);
  }
}

/**
 * Template variable builder
 */

/**
 * Build template variables object from project parameters
 * @param projectName - Name of the project
 * @param provider - Cloud provider (aws, azure, gcp)
 * @param language - Programming language (javascript, typescript, python, go)
 * @returns Object with all template variable mappings
 */
export function buildTemplateVariables(
  projectName: string,
  provider: string,
  _language: string
): Record<string, string> {
  const backendType = getBackendType(provider);
  return {
    'project-name': projectName,
    provider: backendType,
    'provider-name': provider, // Keep original provider name for README
  };
}
