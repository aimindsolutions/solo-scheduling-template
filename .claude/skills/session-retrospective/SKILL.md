---
name: session-retrospective
description: Summarize one finished Claude Code session into durable outcomes, decisions, lessons, risks, and next steps. Use after completing a session or before archiving it.
disable-model-invocation: true
argument-hint: [topic-or-session-name]
---

Your task is to turn one finished Claude Code work session into a durable markdown retrospective.

Follow this workflow strictly:

1. Read the current repository context before summarizing anything:
   - `CLAUDE.md` if it exists
   - `README.md` if it exists
   - `docs/context/_index.md` if it exists
   - existing files under `docs/context/`
   - `docs/decisions.md` and `docs/session-index.md` if they exist
   - any relevant docs under `docs/`, `doc/`, or `documentation/`

2. Ask for or inspect the session source:
   - pasted session summary
   - pasted compact output
   - pasted transcript excerpt
   - current chat context if this session itself is the one being closed

3. Identify:
   - session purpose
   - scope and topic
   - code areas touched
   - key decisions made
   - successful solutions
   - failed approaches worth preserving as warnings only if durable
   - unresolved risks
   - next actions

4. Keep only durable information. Exclude:
   - casual discussion
   - repeated iterations
   - low-value logs
   - temporary experiments with no lasting consequence

5. Before writing, determine whether a topic file already exists in `docs/context/`.
   - If the session belongs to an existing topic, update that topic's memory instead of duplicating it.
   - If not, propose a new topic file name.

6. Create or update a retrospective note in one of these patterns:
   - append a dated retrospective section to the relevant topic file, or
   - create `docs/retrospectives/YYYY-MM-DD-<topic>.md` if the project uses standalone retrospectives

7. Use this structure:

# Session Retrospective: <topic>

## Goal
## What changed
## Key files touched
## Decisions made
## Lessons learned
## Risks / open questions
## Recommended memory updates
## Next steps

8. If the session changed durable project knowledge, also propose updates to:
   - `docs/context/<topic>.md`
   - `docs/decisions.md`
   - `docs/session-index.md`

9. End with a concise changelog of files created or updated.
