---
name: claw-awareness
description: This skill provides background context when the user mentions "claw", "gateway", "daemon", "discord bot", "telegram bot", "messaging platform", "agent scheduling", "cron job", "heartbeat", "canvas", or discusses the claude-claw system. It helps Claude understand the claude-claw plugin and its capabilities.
version: 0.1.0
---

# claude-claw System Context

claude-claw is a Claude Code plugin suite that provides:

- **Gateway daemon** (port 19789) for messaging platform integration
- **Channel adapters** for Discord, Telegram, Slack, and other platforms
- **Session manager** that spawns `claude --print` for AI responses
- **Cron scheduling** and **heartbeat daemon** for autonomous tasks
- **Canvas** visual workspace (port 19793) for agent-driven HTML
- **MCP bridge** (claw-bridge) for inter-session communication

## Available Commands

| Command | Description |
|---------|-------------|
| `/claw-start` | Start the gateway daemon |
| `/claw-stop` | Stop the gateway daemon |
| `/claw-status` | Show daemon status |
| `/claw-config` | Configure adapters, tokens, ports |
| `/claw-onboard` | First-time setup wizard |
| `/claw-cron-add` | Schedule a cron job |
| `/claw-cron-list` | List cron jobs |
| `/claw-cron-remove` | Remove a cron job |
| `/claw-canvas` | Open canvas in browser |
| `/claw-send` | Send a message to a channel |
| `/claw-sessions` | List active sessions |

## State Directory

`~/.claude-claw/` contains:
- `config.json` - Gateway configuration and bot tokens
- `workspace/` - Agent identity and context files (IDENTITY.md, SOUL.md, etc.)
- `sessions/` - Conversation session data
- `memory/` - Daily memory files
- `cron/` - Persistent scheduled jobs
- `logs/` - Gateway and cron logs

## MCP Tools (claw-bridge)

When this plugin is active, Claude has access to these tools:
- `send_message` - Send messages to any connected platform
- `get_channels` - List available channels
- `get_history` - Fetch conversation history
- `canvas_update` - Push HTML to the canvas
- `canvas_clear` - Clear the canvas
- `memory_read` / `memory_write` / `memory_search` - Persistent memory
- `claw_ping` - Check gateway status
