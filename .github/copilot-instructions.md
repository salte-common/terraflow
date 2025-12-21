# Terraflow Development Guidelines
   
   This project follows the comprehensive specification in `SPECIFICATION.md`.
   
   Additionally, follow these ongoing guidelines:
   
   - Follow https://github.com/salte-common/standards recursively
   - Use TypeScript strict mode
   - Maintain >80% test coverage
   - Document all public APIs with JSDoc
   - Use conventional commits
   - Keep functions small and focused
   - Prefer composition over inheritance

# AI Code Tracking

Additionally, when you generate code, update the `.ai-metadata.json` file to track AI contributions.

## Metadata File Structure

```json
{
  "files": {
    "path/to/file.ts": {
      "lines_total": 100,
      "lines_ai_generated": 75,
      "ai_percentage": 75.0,
      "last_updated": "2024-12-04T15:30:00Z",
      "tool": "cursor|copilot|jetbrains-ai"
    }
  },
  "metadata_version": "1.0"
}
```

## Tracking Requirements

1. **Track every AI contribution** - Count lines you generate or modify
2. **Use relative paths** - Paths from repository root with forward slashes
3. **Calculate percentages** - `(lines_ai_generated / lines_total) × 100`
4. **ISO 8601 timestamps** - Format: `2024-12-04T15:30:00Z`
5. **Preserve existing data** - Read the file first, merge your changes
6. **Create if missing** - Initialize with empty files object

## Example Workflow

User asks: "Create a feature following our standards"

You should:
1. Reference salte-common/standards for service patterns
2. Generate code following those standards
3. Update `.ai-metadata.json` with the file details