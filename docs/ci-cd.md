# CI/CD Documentation

This document describes the Continuous Integration and Continuous Deployment setup for Terraflow.

## GitHub Actions Workflows

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Pull requests to `main` or `develop` branches
- Pushes to `main` or `develop` branches

**Jobs:**
1. **Test Job** - Runs tests on Node.js 18.x and 20.x
   - Installs dependencies
   - Runs linting
   - Runs tests with coverage
   - Uploads coverage to Codecov (only on Node 20.x)

2. **Build Job** - Builds the project
   - Depends on test job passing
   - Builds TypeScript to JavaScript
   - Uploads build artifacts

### Publish Workflow (`.github/workflows/publish.yml`)

**Triggers:**
- GitHub release published

**Job:**
- Runs tests and builds the project
- Publishes to NPM with provenance for supply chain security
- Requires `NPM_TOKEN` secret

### Release Workflow (`.github/workflows/release.yml`)

**Triggers:**
- Git tag push matching `v*.*.*` pattern (e.g., `v1.0.0`, `v1.2.3`)

**Job:**
- Builds the project
- Generates changelog from commits since last release
- Creates GitHub release with changelog and build artifacts
- Marks as pre-release if tag contains `-` (e.g., `v1.0.0-beta.1`)

## Required Secrets

The following secrets must be configured in the GitHub repository settings:

### NPM_TOKEN

**Description:** NPM authentication token for publishing packages

**Required for:** `publish.yml` workflow

**How to create:**
1. Go to https://www.npmjs.com/settings/[your-username]/tokens
2. Click "Generate New Token"
3. Select "Automation" token type (for CI/CD)
4. Copy the token
5. Add it to GitHub repository secrets as `NPM_TOKEN`

**Permissions needed:**
- Read and write access to publish packages

### CODECOV_TOKEN (Optional)

**Description:** Codecov token for uploading coverage reports

**Required for:** `ci.yml` workflow (coverage upload step)

**How to create:**
1. Go to https://codecov.io and sign in with GitHub
2. Add the repository to Codecov
3. Copy the repository upload token
4. Add it to GitHub repository secrets as `CODECOV_TOKEN`

**Note:** This is optional. The workflow will still run without it, but coverage won't be uploaded to Codecov.

## Branch Protection Rules

It is recommended to configure branch protection rules for `main` and `develop` branches:

### Required Settings

1. **Require pull request reviews before merging**
   - Required number of approving reviews: 1
   - Dismiss stale pull request approvals when new commits are pushed: ✅

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging: ✅
   - Required status checks:
     - `Test (Node 18.x)`
     - `Test (Node 20.x)`
     - `Build`

3. **Require conversation resolution before merging**: ✅

4. **Do not allow bypassing the above settings**: ✅

### Optional Settings

- **Require linear history**: Recommended for clean git history
- **Include administrators**: Recommended to enforce rules for everyone
- **Restrict who can push to matching branches**: Restrict to maintainers only

### Configuration Steps

1. Go to repository Settings → Branches
2. Click "Add rule" or edit existing rule
3. Branch name pattern: `main` or `develop`
4. Configure the settings above
5. Save changes

## Workflow Permissions

Workflows use the following permissions:

### CI Workflow
- **Read**: Repository contents (via `GITHUB_TOKEN`)

### Publish Workflow
- **Read**: Repository contents
- **Write**: ID token (for NPM provenance)

### Release Workflow
- **Write**: Repository contents (to create releases)

## Best Practices

1. **Always test before publishing** - The publish workflow runs tests before publishing
2. **Use semantic versioning** - Follow semver for version tags
3. **Generate meaningful changelogs** - Use conventional commits for better changelog generation
4. **Review coverage reports** - Monitor test coverage trends on Codecov
5. **Keep dependencies updated** - Regularly update GitHub Actions to latest versions

## Troubleshooting

### Workflow fails on linting

- Run `npm run lint` locally to check for linting errors
- Run `npm run format` to auto-fix formatting issues

### Workflow fails on tests

- Run `npm test` locally to reproduce the issue
- Check test coverage reports to identify untested code paths

### NPM publish fails

- Verify `NPM_TOKEN` secret is correctly configured
- Ensure package version in `package.json` matches the release tag
- Check that you're not trying to publish a version that already exists

### Release creation fails

- Verify you have write permissions to the repository
- Check that the tag format matches `v*.*.*` pattern
- Ensure `GITHUB_TOKEN` has sufficient permissions (should be automatic)

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Codecov Documentation](https://docs.codecov.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

