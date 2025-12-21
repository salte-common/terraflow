# Release Checklist

This document outlines the checklist for releasing Terraflow v1.0.0.

## Pre-Release

- [x] All tests passing (`npm test`)
- [x] Test coverage >80% (`npm run test:coverage`)
- [x] No linting errors (`npm run lint`)
- [x] Build succeeds (`npm run build`)
- [x] Security audit clean (`npm audit`)
- [x] Documentation complete and reviewed
- [x] CHANGELOG.md updated
- [x] Version number in package.json correct
- [x] LICENSE file present
- [x] .npmignore configured correctly

## Release Process

1. **Tag the release**:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. **GitHub Release**:
   - GitHub Actions will automatically create a release when the tag is pushed
   - Release will include changelog and build artifacts
   - Verify release notes are correct

3. **NPM Publish**:
   - GitHub Actions will automatically publish to NPM when a release is published
   - Verify package is available on npmjs.com
   - Test installation: `npm install -g terraflow`

## Post-Release

- [ ] Verify installation works: `npm install -g terraflow`
- [ ] Verify CLI works: `terraflow --version`
- [ ] Update documentation links if repository URL changed
- [ ] Announce release (if applicable)

## Testing Matrix

### Operating Systems
- [ ] Linux (CI - Ubuntu)
- [ ] macOS (Local)
- [ ] Windows (Manual testing recommended)

### Node.js Versions
- [ ] Node.js 18.x (CI)
- [ ] Node.js 20.x (CI)

### Cloud Providers
- [ ] AWS (S3 backend, Secrets Manager, Assume Role)
- [ ] Azure (AzureRM backend, Key Vault, Service Principal)
- [ ] GCP (GCS backend, Secret Manager, Service Account)

## Known Limitations

- Plugin loader has low test coverage (7.89%) - consider adding tests in future release
- Validator has moderate branch coverage (52.85%) - consider adding edge case tests

