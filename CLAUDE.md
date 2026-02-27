# claude-claw

Claude Code plugin suite providing OpenClaw-style messaging, scheduling, and canvas.

## Tech Stack
- TypeScript, Node.js, ESM modules (`"type": "module"`)
- npm workspaces: `gateway/` and `mcp-server/`
- Build: `npm run build` (runs `tsc` in both workspaces)

## Architecture
- Gateway daemon on port 19789 (public API) and 19790 (internal IPC for MCP bridge)
- Canvas server on port 19793
- MCP server (claw-bridge) runs as stdio, communicates with Gateway via HTTP to IPC port
- Session Manager spawns `claude --print` for AI processing
- State directory: `~/.claude-claw/`

## Conventions
- All source in `src/` dirs, compiled to `dist/`
- Adapter pattern for messaging platforms (implement `ChannelAdapter` interface)
- Commands in `commands/` are user-invoked (`/claw-*`)
- Skills in `skills/` are model-invoked (auto-detected by Claude)
