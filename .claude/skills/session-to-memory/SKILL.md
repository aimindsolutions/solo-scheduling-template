---
name: session-to-memory
description: Audit existing markdown files and project documentation, then update or create durable topic-based memory files without duplicating existing docs. Use when consolidating finished sessions into project memory.
disable-model-invocation: true
argument-hint: [topic-or-all]
---

Your task is to consolidate durable project knowledge for $ARGUMENTS into markdown memory files.

Follow this workflow strictly:

1. Check whether these files or directories already exist:
   - `CLAUDE.md`
   - `README.md`
   - `docs/`
   - `doc/`
   - `documentation/`
   - `.claude/`
   - any `*.md` files in the project root
   - any architecture, API, auth, setup, workflow, decisions, changelog, notes, roadmap, retrospective, context, or plan markdown files anywhere in the repository

2. Read and analyze existing project documentation before writing anything new.
   Prioritize:
   - `CLAUDE.md`
   - `README.md`
   - `docs/context/_index.md`
   - `docs/context/architecture.md`
   - `docs/context/data-sync.md`
   - `docs/context/audit-log.md`
   - `docs/context/modules.md`
   - `docs/superpowers/specs/2026-04-23-employee-id-and-audit-log-design.md`
   - `docs/superpowers/plans/2026-04-23-employee-id-and-audit-log.md`
   - `docs/decisions.md` and `docs/session-index.md` if they exist

3. Build a documentation inventory first:
   - file path
   - purpose
   - topic/domain
   - status: current, outdated, duplicate, incomplete, or historical

4. Inspect the repository codebase and infer the main domains and topic buckets.
   Use existing project structure and docs to map areas such as architecture, modules, audit log, data sync, persistence, and related features.

5. Compare repository reality with existing docs.
   Detect:
   - missing documentation
   - outdated documentation
   - duplicated documentation
   - contradictions between code and docs
   - topics that deserve separate memory files

6. If the user provided session summaries, compact outputs, exports, or pasted session text, use them as an additional source.
   Otherwise work from repository state plus documentation.

7. Prefer updating existing docs over creating duplicate files.
   Rules:
   - if a matching file already exists, update it
   - if several files overlap, consolidate carefully
   - do not create a new file if the topic is already documented well enough
   - preserve useful historical notes, but move stale operational noise out of the main memory files

8. For each topic memory file, preserve only durable knowledge:
   - purpose
   - current behavior
   - key files and directories
   - flows
   - decisions
   - constraints
   - assumptions
   - risks
   - TODOs
   - validation steps
   - useful notes and gotchas

9. Exclude noise:
   - repeated failed attempts
   - casual conversation
   - temporary experiments
   - low-value logs
   - speculative ideas not implemented
   - obsolete notes unless still historically important

10. Use this structure for each topic file:

# <topic>

## Purpose
## Current behavior
## Key files
## Flows
## Decisions
## Constraints
## Risks
## TODO
## Validation
## Notes

11. Maintain these shared files when useful:
   - `docs/context/_index.md`
   - `docs/decisions.md`
   - `docs/session-index.md`

12. If existing documentation conflicts with code, do not silently overwrite it.
   Record the conflict, preserve historical context if useful, and write the corrected current understanding clearly.

13. End with:
   - docs found
   - files reused
   - files updated
   - files created
   - remaining documentation gaps
