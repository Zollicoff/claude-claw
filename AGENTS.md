# AGENTS.md (Minimal)

## Goal
Resolve the task with minimal, production-safe changes.

## Required commands
- Install: `npm install`
- Build all workspaces: `npm run build`
- Dev (gateway): `npm run dev`

## Hard constraints
- Do not change protocol or public APIs unless explicitly required.
- Avoid cross-workspace refactors unless needed for task completion.
- Keep edits focused and reversible.

## Repo-specific gotchas
- Monorepo workspaces: `gateway`, `mcp-server`.
- Validate workspace-specific impacts before finalizing.

## Output
- concise summary
- files changed
- exact commands run + pass/fail
- known risks + next step
