---
name: context-rebuild
description: Rebuild CLAUDE.md or a project context file from the current codebase and existing documentation when project docs have drifted or become outdated.
disable-model-invocation: true
argument-hint: [target-file]
---

Your task is to rebuild a lean, accurate project context file from the current repository state.

Use this skill when:
- `CLAUDE.md` is outdated
- the project has evolved beyond its initial workflow docs
- a clean startup context is needed for future Claude Code sessions
- the team needs a compact current-state brief instead of many scattered notes

Follow this workflow strictly:

1. Read existing project documentation first:
   - target file if it already exists
   - `README.md`
   - `docs/context/_index.md`
   - all files under `docs/context/`
   - `docs/decisions.md` and `docs/session-index.md` if they exist
   - relevant design specs and plans under `docs/superpowers/`

2. Inspect the current repository and identify:
   - actual app purpose
   - major modules and pages
   - architecture and state model
   - persistence layers and sync behavior
   - important commands and validation steps
   - constraints, quirks, and gotchas
   - what is current versus historical

3. Compare docs against code and detect drift.
   Explicitly note:
   - outdated statements
   - missing current behavior
   - workflow changes
   - obsolete assumptions

4. Rebuild the requested target file as a compact current-state guide.
   Default target: `CLAUDE.md` unless the user names another file.

5. Keep the rebuilt context file lean.
   Favor concise bullets and references to deeper docs rather than long explanations.

6. Prefer a structure like this:

# Project context

## What this project is
## Current architecture
## Main modules
## Persistence and sync
## Important files
## Commands
## Constraints and gotchas
## Current priorities
## Where to read more

7. In "Where to read more", point to deeper documentation instead of repeating it, especially:
   - `docs/context/_index.md`
   - `docs/context/architecture.md`
   - `docs/context/data-sync.md`
   - `docs/context/audit-log.md`
   - `docs/context/modules.md`
   - active specs under `docs/superpowers/specs/`

8. Do not include:
   - long historical narratives
   - completed plan details that no longer matter
   - duplicate explanations already covered well in docs
   - speculative future ideas unless they are active priorities

9. If documentation gaps remain, add a short section listing them separately rather than bloating the context file.

10. End with:
   - drift detected
   - what was rebuilt
   - what deeper docs were referenced
   - what gaps still remain
