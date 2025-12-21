# Contributing to Terraflow

Thank you for your interest in contributing to Terraflow! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/terraflow.git
   cd terraflow
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Making Changes

1. Make your changes in a feature branch
2. Write or update tests for your changes
3. Ensure all tests pass:
   ```bash
   npm test
   ```
4. Ensure linting passes:
   ```bash
   npm run lint
   ```
5. Format your code:
   ```bash
   npm run format
   ```
6. Build to check for TypeScript errors:
   ```bash
   npm run build
   ```

### Testing

- Write unit tests for new functionality
- Write integration tests for complex workflows
- Maintain or improve test coverage (minimum 80%)
- Run tests before submitting:
  ```bash
  npm test
  npm run test:coverage
  ```

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier (configured in project)
- Add JSDoc comments for public APIs
- Follow existing code patterns and conventions

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(backend): add support for Azure Blob Storage backend

fix(validator): validate workspace name format correctly

docs(config): update configuration examples
```

## Pull Request Process

1. **Update documentation** if needed (README, config docs, etc.)
2. **Add tests** for new features or bug fixes
3. **Ensure CI passes** - All checks must be green
4. **Update CHANGELOG.md** if applicable
5. **Request review** from maintainers

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Commit messages follow conventional commits
- [ ] No breaking changes (or documented if intentional)
- [ ] CHANGELOG.md updated (if applicable)

## Development Guidelines

### Plugin Development

If you're adding a new plugin, see [docs/plugins.md](./docs/plugins.md) for:
- Plugin interface specifications
- Development patterns
- Testing guidelines
- Best practices

### Adding Features

1. Check existing issues and PRs to avoid duplicates
2. Open an issue to discuss major features before implementing
3. Keep changes focused and atomic
4. Update documentation alongside code changes
5. Consider backward compatibility

### Bug Reports

When reporting bugs, please include:
- Terraflow version
- Node.js version
- Operating system
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant configuration files (sanitized)

### Feature Requests

For feature requests:
- Describe the use case
- Explain why it would be useful
- Provide examples if possible
- Consider implementation complexity

## Project Structure

```
terraflow/
├── src/
│   ├── commands/      # Command handlers
│   ├── core/          # Core functionality
│   ├── plugins/       # Backend, secrets, auth plugins
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── tests/
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── mocks/         # Test mocks
└── docs/              # Documentation
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.ts

# Watch mode
npm test -- --watch
```

### Writing Tests

- Use Jest testing framework
- Mock external dependencies (AWS SDK, file system, etc.)
- Test both success and error cases
- Use descriptive test names
- Keep tests focused and independent

### Test Coverage

- Aim for >80% code coverage
- Cover edge cases and error paths
- Mock external services appropriately

## Documentation

### Code Documentation

- Add JSDoc comments to all public APIs
- Document parameters, return values, and exceptions
- Include usage examples in comments where helpful

### User Documentation

- Update README.md for user-facing changes
- Update docs/configuration.md for config changes
- Add examples to docs/examples/ for new features
- Keep documentation in sync with code

## Release Process

Releases are managed by maintainers. The process:

1. Version bump in package.json
2. Update CHANGELOG.md
3. Create git tag (v*.*.*)
4. GitHub Actions automatically publishes to NPM

## Questions?

- Open an issue for questions or discussions
- Check existing documentation first
- Review existing code for examples

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

