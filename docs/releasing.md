# Release Process

This document describes the complete release process for Terraflow, including how to publish alpha, beta, release candidate, and production versions.

## Overview

Terraflow uses an automated release process that:
1. Detects version changes in `package.json`
2. Automatically creates git tags
3. Publishes to NPM with appropriate dist-tags
4. Creates GitHub releases with changelogs

## Version Format

All versions must follow [Semantic Versioning](https://semver.org/) (semver) format:

- **Production releases**: `N.N.N` (e.g., `1.0.0`, `1.2.3`)
- **Pre-releases**: `N.N.N-{alpha|beta|rc}.N` (e.g., `1.0.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.3`)

The CI workflow validates that `package.json` version matches this format and will fail if invalid.

## Release Types and NPM Dist-Tags

| Version Pattern | NPM Dist-Tag | Description |
|----------------|--------------|-------------|
| `1.0.0-alpha.1` | `alpha` | Alpha pre-release |
| `1.0.0-beta.1` | `beta` | Beta pre-release |
| `1.0.0-rc.1` | `next` | Release candidate |
| `1.0.0` | `latest` | Production release |

## Complete Release Workflow

### Step-by-Step Process

1. **Update package.json version**
   ```bash
   # Edit package.json and update the version field
   # Example: "version": "1.0.0-rc.1"
   ```

2. **Commit and push to main**
   ```bash
   git add package.json
   git commit -m "chore: bump version to 1.0.0-rc.1"
   git push origin main
   ```

3. **Auto-tag workflow creates tag**
   - The `auto-tag.yml` workflow detects the version change
   - Creates a git tag matching the version (e.g., `1.0.0-rc.1`)
   - Pushes the tag to the repository

4. **Publish workflow publishes to NPM**
   - The `publish.yml` workflow triggers on tag push
   - Verifies package.json version matches the tag
   - Determines appropriate NPM dist-tag based on version
   - Runs tests and builds the project
   - Publishes to NPM with the correct dist-tag

5. **Release workflow creates GitHub release**
   - The `release.yml` workflow triggers on tag push
   - Generates changelog from commits
   - Creates GitHub release with:
     - Changelog content
     - Installation instructions
     - Pre-release flag (if version contains `-`)
     - Build artifacts attached

## Example Scenarios

### Publishing an Alpha Release

```bash
# 1. Update package.json
# "version": "1.0.0-alpha.1"

# 2. Commit and push
git add package.json
git commit -m "chore: release 1.0.0-alpha.1"
git push origin main

# 3. Workflows automatically:
#    - Create tag "1.0.0-alpha.1"
#    - Publish to NPM with --tag alpha
#    - Create GitHub release (marked as pre-release)
```

**Result:**
- Tag: `1.0.0-alpha.1`
- NPM: `npm install -g terraflow@alpha` or `npm install -g terraflow@1.0.0-alpha.1`
- GitHub: Pre-release with changelog

### Publishing a Release Candidate

```bash
# 1. Update package.json
# "version": "1.0.0-rc.1"

# 2. Commit and push
git add package.json
git commit -m "chore: release 1.0.0-rc.1"
git push origin main

# 3. Workflows automatically:
#    - Create tag "1.0.0-rc.1"
#    - Publish to NPM with --tag next
#    - Create GitHub release (marked as pre-release)
```

**Result:**
- Tag: `1.0.0-rc.1`
- NPM: `npm install -g terraflow@next` or `npm install -g terraflow@1.0.0-rc.1`
- GitHub: Pre-release with changelog

### Publishing a Production Release

```bash
# 1. Update package.json
# "version": "1.0.0"

# 2. Commit and push
git add package.json
git commit -m "chore: release 1.0.0"
git push origin main

# 3. Workflows automatically:
#    - Create tag "1.0.0"
#    - Publish to NPM with --tag latest (default)
#    - Create GitHub release (not marked as pre-release)
```

**Result:**
- Tag: `1.0.0`
- NPM: `npm install -g terraflow` or `npm install -g terraflow@latest` or `npm install -g terraflow@1.0.0`
- GitHub: Full release with changelog

## Required GitHub Secrets

The following secrets must be configured in your GitHub repository settings:

### Required Secrets

- **`NPM_TOKEN`**: NPM authentication token for publishing packages
  - Generate at: https://www.npmjs.com/settings/{username}/tokens
  - Required scopes: `publish`, `read`
  - Used by: `publish.yml` workflow

### Optional Secrets

- **`CODECOV_TOKEN`**: Codecov token for coverage uploads
  - Get from: https://codecov.io
  - Used by: `ci.yml` workflow (only on main branch)
  - Optional: CI will still pass without it, but coverage won't be uploaded

## Workflow Permissions

All workflows use appropriate permissions:

- **`ci.yml`**: No special permissions (read-only)
- **`auto-tag.yml`**: `contents: write` (to create and push tags)
- **`publish.yml`**: `contents: read`, `id-token: write` (for NPM provenance)
- **`release.yml`**: `contents: write` (to create GitHub releases)

## Version Validation

The CI workflow automatically validates that `package.json` version follows semver format:

- ✅ Valid: `1.0.0`, `1.2.3`, `1.0.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.3`
- ❌ Invalid: `1.0`, `v1.0.0`, `1.0.0-snapshot`, `1.0.0-invalid.1`

If validation fails, the CI workflow will fail with a clear error message.

## Troubleshooting

### Tag Already Exists

If a tag already exists, the `auto-tag.yml` workflow will skip tag creation. To recreate a tag:

1. Delete the tag locally: `git tag -d 1.0.0-rc.1`
2. Delete the tag remotely: `git push origin :refs/tags/1.0.0-rc.1`
3. Update package.json version and push again

### Version Mismatch Error

If `publish.yml` fails with "Tag version does not match package.json version":

1. Ensure the tag name exactly matches the version in `package.json`
2. The auto-tag workflow should handle this automatically
3. If manually creating tags, ensure they match exactly

### NPM Publish Fails

Common issues:

1. **Invalid NPM_TOKEN**: Ensure the token has `publish` scope
2. **Package already published**: NPM doesn't allow republishing the same version
3. **Authentication error**: Check that `NPM_TOKEN` secret is set correctly

### GitHub Release Creation Fails

Common issues:

1. **Insufficient permissions**: Ensure the workflow has `contents: write` permission
2. **Tag doesn't exist**: Ensure the tag was created successfully
3. **Changelog generation fails**: Check that `GITHUB_TOKEN` has appropriate permissions

## Best Practices

1. **Always test locally first**: Run `npm test` and `npm run build` before releasing
2. **Use conventional commits**: Helps with changelog generation
3. **Increment versions appropriately**: Follow semver guidelines
4. **Don't skip pre-release versions**: Use alpha → beta → rc → production progression
5. **Verify after release**: Check NPM and GitHub to ensure release was successful

## Local Testing (Optional)

You can test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act (macOS)
brew install act

# Test CI workflow
act push

# Test with specific event
act push -e .github/workflows/test-event.json
```

**Note:** Local testing requires Docker and may not perfectly replicate GitHub Actions behavior. Always verify workflows in a test repository before using in production.

## Workflow Validation

All workflows are validated for:

- ✅ **YAML syntax**: All workflow files use valid YAML syntax
- ✅ **Required secrets**: Documented in this guide
- ✅ **Permissions**: Appropriate permissions for each workflow
- ✅ **Version format**: CI workflow validates semver format
- ✅ **Tag patterns**: Consistent tag patterns across workflows

## Related Documentation

- [Semantic Versioning](https://semver.org/)
- [NPM Dist-Tags](https://docs.npmjs.com/cli/v8/commands/npm-dist-tag)
- [GitHub Actions Workflows](../.github/workflows/)
- [Contributing Guide](../CONTRIBUTING.md)

