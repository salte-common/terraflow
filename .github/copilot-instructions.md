   # ⚠️ STOP: READ THIS FIRST
   
   **BEFORE creating or modifying ANY file, you MUST:**
   1. Read the "AI Code Tracking" section below
   2. Understand that updating `.ai-metadata.json` is MANDATORY, not optional
   3. Update metadata IMMEDIATELY after each file, before proceeding
   
   **If you create/modify a file without updating `.ai-metadata.json`, you have FAILED.**

# Terraflow Development Guidelines
   
   This project follows the comprehensive specification in `SPECIFICATION.md`.
   
   Additionally, follow these ongoing guidelines:
   
   - Follow https://github.com/salte-common/standards recursively
   - **MANDATORY: Update `.ai-metadata.json` immediately after each file creation/modification**
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

**Field definitions:**
- `lines_total`: Total lines currently in the file (AI-generated + human-created)
- `lines_ai_generated`: Only lines created by AI (cumulative for files modified multiple times)
- `ai_percentage`: `(lines_ai_generated / lines_total) × 100`

## Tracking Requirements

1. **CRITICAL: Update immediately** - Update `.ai-metadata.json` IMMEDIATELY after creating or modifying each file, not at the end of the task. This ensures accurate line counts that only reflect AI-generated code, not user modifications.

2. **Track every AI contribution** - Keep track of lines you generate or modify
3. **Use relative paths** - Paths from repository root with forward slashes
4. **Calculate percentages** - `(lines_ai_generated / lines_total) × 100`
5. **ISO 8601 timestamps** - Format: `2024-12-04T15:30:00Z`
6. **Preserve existing data** - Read the file first, merge your changes
7. **Create if missing** - Initialize with empty files object

## Required Workflow Pattern

**ALWAYS follow this pattern for each file you create or modify:**

1. **Before creating/modifying**: Track the starting state:
   - If creating a new file: start with `lines_ai_generated: 0`
   - If modifying existing file: read `.ai-metadata.json` first to get current `lines_ai_generated` value
   
2. **While generating code**: Count lines AS YOU ADD THEM:
   - Track each line of code, comments, blank lines, etc. that you generate
   - Keep a running count as you write the file
   - Count everything you add, including:
     - Import statements
     - Type definitions
     - Functions and methods
     - Comments and JSDoc
     - Blank lines for formatting
   
3. **After creating/modifying**: Update metadata immediately:
   - Read `.ai-metadata.json` (or create if missing)
   - For NEW files: 
     - `lines_total`: Read the file to get total lines (all AI-generated in this case)
     - `lines_ai_generated`: All lines you added (same as `lines_total` for new files)
   - For MODIFIED files:
     - `lines_total`: Read the current file to get total lines (includes AI-generated + any human-created lines)
     - `lines_ai_generated`: Previous `lines_ai_generated` value from metadata + lines you just added (only AI-generated lines)
   - `ai_percentage`: Calculate `(lines_ai_generated / lines_total) × 100`
   - `last_updated`: Current UTC timestamp
   - `tool`: "cursor"
   - Write the updated `.ai-metadata.json` back
   
   **Important distinctions:**
   - `lines_total`: Always the current total lines in the file (AI + human created)
   - `lines_ai_generated`: Only lines created by AI (cumulative for modified files)
   
4. Then proceed to the next file

**DO NOT:**
- Wait until the end to update metadata
- Batch update multiple files at once
- Include human-created lines in `lines_ai_generated` - only count AI-generated lines
- Guess `lines_total` - always read the file to get the accurate total count

## Example Workflow

**Example 1: Creating a new file**

User asks: "Create a feature following our standards"

1. Reference salte-common/standards for service patterns
2. **Create `src/features/my-feature.ts`**: 
   - Write the file content (tracking 50 lines as you generate them)
   - Read the file: total lines = 50
   - **IMMEDIATELY** read `.ai-metadata.json`
   - Add entry: `{"src/features/my-feature.ts": {"lines_total": 50, "lines_ai_generated": 50, "ai_percentage": 100.0, ...}}`
   - **IMMEDIATELY** write updated `.ai-metadata.json` back

**Example 2: Modifying an existing file**

User asks: "Add error handling to the validator"

1. Read `.ai-metadata.json` - find existing entry shows `lines_ai_generated: 29`
2. Read current `src/core/validator.ts` - file has 29 total lines
3. Add error handling code (tracking 15 new lines as you generate them)
4. Read the file again: now has 44 total lines
5. **IMMEDIATELY** read `.ai-metadata.json`
6. Update entry: `{"src/core/validator.ts": {"lines_total": 44, "lines_ai_generated": 44, "ai_percentage": 100.0, ...}}`
   - `lines_total`: 44 (read from file - total lines currently in file)
   - `lines_ai_generated`: 29 (previous) + 15 (new AI lines) = 44
   
   **If user had added 10 lines between sessions:**
   - File now has 54 total lines (29 original + 10 user-added + 15 new AI)
   - `lines_total`: 54 (read from file)
   - `lines_ai_generated`: 29 (previous) + 15 (new AI lines) = 44 (does NOT include user's 10 lines)
   - `ai_percentage`: (44 / 54) × 100 = 81.5%
7. **IMMEDIATELY** write updated `.ai-metadata.json` back

**Remember:** 
- `lines_total` = current total lines in file (read the file to get this)
- `lines_ai_generated` = only lines created by AI (track as you generate, add to previous value)
- Track lines AS YOU GENERATE THEM, then update metadata immediately
- Update metadata immediately after EACH file, not after all files are done