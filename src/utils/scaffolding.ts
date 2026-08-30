/**
 * Scaffolding utilities for project initialization
 * Handles template processing and file generation
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
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

  // main.tf - provider-specific
  const mainTemplate = loadTemplate(join(templatesDir, provider, 'main.tf.template'));
  const mainContent = processTemplate(mainTemplate, { 'project-name': projectName });
  writeFileSync(join(terraformDir, 'main.tf'), mainContent);

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
  if (language === 'javascript') {
    const packageJsonTemplate = loadTemplate(join(templatesDir, language, 'package.json.template'));
    const packageJsonContent = processTemplate(packageJsonTemplate, {
      'project-name': projectName,
    });
    writeFileSync(join(projectDir, 'package.json'), packageJsonContent);

    // ESLint config
    const eslintTemplate = loadTemplate(join(templatesDir, language, '.eslintrc.json.template'));
    writeFileSync(join(projectDir, '.eslintrc.json'), eslintTemplate);

    // Jest config
    const jestTemplate = loadTemplate(join(templatesDir, language, 'jest.config.js.template'));
    writeFileSync(join(projectDir, 'jest.config.js'), jestTemplate);

    // Prettier config
    const prettierTemplate = loadTemplate(join(templatesDir, language, '.prettierrc.template'));
    writeFileSync(join(projectDir, '.prettierrc'), prettierTemplate);
  } else if (language === 'typescript') {
    // package.json
    const packageJsonTemplate = loadTemplate(join(templatesDir, language, 'package.json.template'));
    const packageJsonContent = processTemplate(packageJsonTemplate, {
      'project-name': projectName,
    });
    writeFileSync(join(projectDir, 'package.json'), packageJsonContent);

    // tsconfig.json
    const tsconfigTemplate = loadTemplate(join(templatesDir, language, 'tsconfig.json.template'));
    writeFileSync(join(projectDir, 'tsconfig.json'), tsconfigTemplate);

    // ESLint config
    const eslintTemplate = loadTemplate(join(templatesDir, language, '.eslintrc.json.template'));
    writeFileSync(join(projectDir, '.eslintrc.json'), eslintTemplate);

    // Jest config
    const jestTemplate = loadTemplate(join(templatesDir, language, 'jest.config.js.template'));
    writeFileSync(join(projectDir, 'jest.config.js'), jestTemplate);

    // Prettier config
    const prettierTemplate = loadTemplate(join(templatesDir, language, '.prettierrc.template'));
    writeFileSync(join(projectDir, '.prettierrc'), prettierTemplate);
  } else if (language === 'python') {
    // requirements.txt
    const requirementsTemplate = loadTemplate(
      join(templatesDir, language, 'requirements.txt.template')
    );
    writeFileSync(join(projectDir, 'requirements.txt'), requirementsTemplate);

    // pytest.ini
    const pytestTemplate = loadTemplate(join(templatesDir, language, 'pytest.ini.template'));
    writeFileSync(join(projectDir, 'pytest.ini'), pytestTemplate);

    // pylintrc
    const pylintTemplate = loadTemplate(join(templatesDir, language, '.pylintrc.template'));
    writeFileSync(join(projectDir, '.pylintrc'), pylintTemplate);
  } else if (language === 'go') {
    // go.mod
    const goModTemplate = loadTemplate(join(templatesDir, language, 'go.mod.template'));
    const goModContent = processTemplate(goModTemplate, { 'project-name': projectName });
    writeFileSync(join(projectDir, 'go.mod'), goModContent);

    // golangci-lint config
    const golangciTemplate = loadTemplate(join(templatesDir, language, '.golangci.yml.template'));
    writeFileSync(join(projectDir, '.golangci.yml'), golangciTemplate);
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
 * Build template variables for development standards Cursor rules
 * @param language - Programming language (javascript, typescript, python, go)
 * @param provider - Cloud provider (aws, azure, gcp)
 * @returns Variables for cursor-development-standards.mdc.template
 */
function getDevelopmentStandardsVariables(
  language: string,
  provider: string
): Record<string, string> {
  const languageMap: Record<
    string,
    {
      display: string;
      testFramework: string;
      runtime: string;
      standards: string;
      lintCommand: string;
      testCommand: string;
      buildValidation: string;
    }
  > = {
    javascript: {
      display: 'JavaScript',
      testFramework: 'Jest',
      runtime: 'Node.js',
      standards: 'JavaScript Standards',
      lintCommand: 'npm run lint',
      testCommand: 'npm test',
      buildValidation: 'Not required — JavaScript has no compile step.',
    },
    typescript: {
      display: 'TypeScript',
      testFramework: 'Jest',
      runtime: 'Node.js',
      standards: 'JavaScript Standards',
      lintCommand: 'npm run lint',
      testCommand: 'npm test',
      buildValidation: 'npm run build',
    },
    python: {
      display: 'Python',
      testFramework: 'pytest',
      runtime: 'Python',
      standards: 'Python Standards',
      lintCommand: 'pylint src',
      testCommand: 'pytest',
      buildValidation: 'python -m compileall src/main src/test',
    },
    go: {
      display: 'Go',
      testFramework: 'go test',
      runtime: 'Go',
      standards: 'Development Standards',
      lintCommand: 'golangci-lint run ./...',
      testCommand: 'go test ./...',
      buildValidation: 'go build ./...',
    },
  };

  const defaultLang = {
    display: language,
    testFramework: 'tests',
    runtime: language,
    standards: 'Development Standards',
    lintCommand: 'npm run lint',
    testCommand: 'npm test',
    buildValidation: 'npm run build',
  };

  const providerMap: Record<string, { display: string; platformStandards: string }> = {
    aws: {
      display: 'AWS',
      platformStandards: 'AWS Architecture Standards',
    },
    azure: {
      display: 'Azure',
      platformStandards: 'Azure deployment and architecture patterns',
    },
    gcp: {
      display: 'GCP',
      platformStandards: 'GCP deployment and architecture patterns',
    },
  };

  const lang = languageMap[language] ?? defaultLang;
  const prov = providerMap[provider] ?? {
    display: provider,
    platformStandards: 'platform-specific standards',
  };

  return {
    'language-display': lang.display,
    'provider-display': prov.display,
    'test-framework': lang.testFramework,
    runtime: lang.runtime,
    'language-standards': lang.standards,
    'platform-standards': prov.platformStandards,
    'lint-command': lang.lintCommand,
    'test-command': lang.testCommand,
    'build-validation': lang.buildValidation,
  };
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
    'cloud-provider': provider, // Add provider field
  });
  writeFileSync(join(projectDir, '.tfwconfig.yml'), tfwconfigContent);

  // .env.example
  const envExampleTemplate = loadTemplate(join(templatesDir, 'env.example.template'));
  writeFileSync(join(projectDir, '.env.example'), envExampleTemplate);

  // .gitignore
  const gitignoreTemplate = loadTemplate(join(templatesDir, 'gitignore.template'));
  // gitignore template already includes all languages, no processing needed
  writeFileSync(join(projectDir, '.gitignore'), gitignoreTemplate);

  // .editorconfig
  const editorconfigTemplate = loadTemplate(join(templatesDir, 'editorconfig.template'));
  writeFileSync(join(projectDir, '.editorconfig'), editorconfigTemplate);

  // README.md
  const readmeTemplate = loadTemplate(join(templatesDir, 'README.md.template'));
  const readmeContent = processTemplate(readmeTemplate, {
    'project-name': projectName,
    provider: provider, // Use original provider name for README
  });
  writeFileSync(join(projectDir, 'README.md'), readmeContent);

  // .cursor/rules/terraform.mdc - Cursor instructions for Terraflow usage
  const cursorRulesDir = join(projectDir, '.cursor', 'rules');
  mkdirSync(cursorRulesDir, { recursive: true });
  const cursorRulesTemplate = loadTemplate(
    join(templatesDir, 'cursor-terraflow-instructions.mdc.template')
  );
  writeFileSync(join(cursorRulesDir, 'terraform.mdc'), cursorRulesTemplate);

  // .cursor/rules/ai-metadata.mdc - Cursor instructions for .ai-metadata.json maintenance
  const aiMetadataRulesTemplate = loadTemplate(
    join(templatesDir, 'cursor-ai-metadata.mdc.template')
  );
  writeFileSync(join(cursorRulesDir, 'ai-metadata.mdc'), aiMetadataRulesTemplate);

  // .cursor/rules/development-standards.mdc - Cursor instructions for development standards
  const devStandardsTemplate = loadTemplate(
    join(templatesDir, 'cursor-development-standards.mdc.template')
  );
  const devStandardsVars = getDevelopmentStandardsVariables(language, provider);
  const devStandardsContent = processTemplate(devStandardsTemplate, devStandardsVars);
  writeFileSync(join(cursorRulesDir, 'development-standards.mdc'), devStandardsContent);

  generateEditorSettings(projectDir, language);
  generateGitHooks(projectDir);

  Logger.debug('Configuration files generated successfully');
}

/**
 * Generate VS Code / Cursor editor settings for format-on-save and linting
 * @param projectDir - Root directory of the project
 * @param language - Programming language (javascript, typescript, python, go)
 */
export function generateEditorSettings(projectDir: string, language: string): void {
  const supportedLanguages = ['javascript', 'typescript', 'python', 'go'];
  const settingsLanguage = supportedLanguages.includes(language) ? language : 'javascript';
  const settingsTemplate = loadTemplate(
    join('config', 'vscode', `settings.${settingsLanguage}.json.template`)
  );
  const vscodeDir = join(projectDir, '.vscode');
  mkdirSync(vscodeDir, { recursive: true });
  writeFileSync(join(vscodeDir, 'settings.json'), settingsTemplate);

  Logger.debug(`Editor settings generated in .vscode/ (${settingsLanguage})`);
}

/**
 * Generate git hooks for secret scanning in commits
 * @param projectDir - Root directory of the project
 */
export function generateGitHooks(projectDir: string): void {
  const hooksDir = join(projectDir, '.githooks');
  mkdirSync(hooksDir, { recursive: true });

  const preCommitTemplate = loadTemplate(join('config', 'githooks', 'pre-commit.template'));
  const preCommitPath = join(hooksDir, 'pre-commit');
  writeFileSync(preCommitPath, preCommitTemplate, { mode: 0o755 });
  chmodSync(preCommitPath, 0o755);

  const scriptsDir = join(projectDir, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });
  const setupScriptTemplate = loadTemplate(
    join('config', 'scripts', 'setup-githooks.sh.template')
  );
  const setupScriptPath = join(scriptsDir, 'setup-githooks.sh');
  writeFileSync(setupScriptPath, setupScriptTemplate, { mode: 0o755 });
  chmodSync(setupScriptPath, 0o755);

  Logger.debug('Git hooks generated in .githooks/');
}

/**
 * Point git at the scaffolded hooks directory when already in a repository
 * @param projectDir - Root directory of the project
 */
export function configureGitHooksPath(projectDir: string): void {
  const gitDir = join(projectDir, '.git');
  if (!existsSync(gitDir)) {
    Logger.debug('No .git directory; skipping core.hooksPath configuration');
    return;
  }

  const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: projectDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    Logger.warn(
      `Could not set core.hooksPath: ${result.stderr?.trim() || 'unknown error'}. Run ./scripts/setup-githooks.sh after git init.`
    );
    return;
  }

  Logger.debug('Configured git core.hooksPath=.githooks');
}

/**
 * Read a git config value (local or global)
 */
function gitConfigGet(projectDir: string, key: string): string | undefined {
  const result = spawnSync('git', ['config', '--get', key], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

/**
 * Ensure git user identity is configured so the initial commit can succeed
 */
function ensureGitIdentity(projectDir: string): void {
  if (!gitConfigGet(projectDir, 'user.email')) {
    spawnSync('git', ['config', 'user.email', 'terraflow@local.dev'], {
      cwd: projectDir,
      encoding: 'utf8',
    });
  }
  if (!gitConfigGet(projectDir, 'user.name')) {
    spawnSync('git', ['config', 'user.name', 'Terraflow'], {
      cwd: projectDir,
      encoding: 'utf8',
    });
  }
}

/**
 * Initialize git, enable secret-scanning hooks, and create the initial commit
 * @param projectDir - Root directory of the project
 */
export function initializeGitRepository(projectDir: string): void {
  const gitDir = join(projectDir, '.git');
  if (!existsSync(gitDir)) {
    const initResult = spawnSync('git', ['init'], {
      cwd: projectDir,
      encoding: 'utf8',
    });
    if (initResult.status !== 0) {
      Logger.warn(
        `Could not initialize git repository: ${initResult.stderr?.trim() || 'unknown error'}. Run git init manually.`
      );
      return;
    }
    Logger.debug('Initialized git repository');
  }

  configureGitHooksPath(projectDir);
  ensureGitIdentity(projectDir);

  const addResult = spawnSync('git', ['add', '-A'], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  if (addResult.status !== 0) {
    Logger.warn(
      `Could not stage scaffolded files: ${addResult.stderr?.trim() || 'unknown error'}`
    );
    return;
  }

  const commitResult = spawnSync('git', ['commit', '-m', 'Initialized'], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  if (commitResult.status !== 0) {
    Logger.warn(
      `Could not create initial commit: ${commitResult.stderr?.trim() || 'unknown error'}`
    );
    return;
  }

  Logger.debug('Created initial git commit');
}

/**
 * Get list of scaffolded file paths (relative to project root) for AI metadata
 * Only includes files that are checked into source control
 * @param language - Programming language (javascript, typescript, python, go)
 * @returns Array of relative file paths
 */
function getScaffoldedFilePaths(language: string): string[] {
  const common = [
    '.tfwconfig.yml',
    '.env.example',
    '.gitignore',
    '.editorconfig',
    'README.md',
    '.cursor/rules/terraform.mdc',
    '.cursor/rules/ai-metadata.mdc',
    '.cursor/rules/development-standards.mdc',
    '.githooks/pre-commit',
    'scripts/setup-githooks.sh',
    '.vscode/settings.json',
    'terraform/_init.tf',
    'terraform/inputs.tf',
    'terraform/locals.tf',
    'terraform/main.tf',
    'terraform/outputs.tf',
    'terraform/modules/inputs.tf',
    'terraform/modules/main.tf',
    'terraform/modules/outputs.tf',
  ];

  const languageFiles: Record<string, string[]> = {
    javascript: [
      'src/main/index.js',
      'src/test/index.spec.js',
      'package.json',
      '.eslintrc.json',
      'jest.config.js',
      '.prettierrc',
    ],
    typescript: [
      'src/main/index.ts',
      'src/test/index.spec.ts',
      'package.json',
      'tsconfig.json',
      '.eslintrc.json',
      'jest.config.js',
      '.prettierrc',
    ],
    python: [
      'src/main/index.py',
      'src/test/test_main.py',
      'requirements.txt',
      'pytest.ini',
      '.pylintrc',
    ],
    go: ['src/main/index.go', 'src/test/main_test.go', 'go.mod', '.golangci.yml'],
  };

  return [...common, ...(languageFiles[language] ?? [])];
}

/**
 * Generate initial .ai-metadata.json with stats for all scaffolded files
 * All scaffolded files are treated as 100% AI-authored (from templates)
 * Only tracks files that are checked into source control
 * @param projectDir - Root directory of the project
 * @param language - Programming language (javascript, typescript, python, go)
 */
export async function generateAiMetadata(projectDir: string, language: string): Promise<void> {
  const filePaths = getScaffoldedFilePaths(language);
  const files: Record<
    string,
    {
      lines_total: number;
      lines_ai_generated: number;
      ai_percentage: number;
      last_updated: string;
      tool: string;
    }
  > = {};

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  for (const relPath of filePaths) {
    const fullPath = join(projectDir, relPath);
    if (!existsSync(fullPath)) continue;

    const content = readFileSync(fullPath, 'utf8');
    const linesTotal = content.split(/\r?\n/).length;

    files[relPath] = {
      lines_total: linesTotal,
      lines_ai_generated: linesTotal,
      ai_percentage: 100,
      last_updated: timestamp,
      tool: 'cursor',
    };
  }

  const metadata = {
    files,
    metadata_version: '1.0',
  };

  writeFileSync(join(projectDir, '.ai-metadata.json'), JSON.stringify(metadata, null, 2));
  Logger.debug('Initial .ai-metadata.json generated');
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
