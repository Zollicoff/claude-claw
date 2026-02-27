# claude-claw

A Claude Code plugin suite that brings OpenClaw's messaging, scheduling, and canvas capabilities natively into Claude Code.

Instead of running a separate agent that calls LLM APIs directly, claude-claw runs as a plugin inside Claude Code's ecosystem -- using the `claude` CLI itself as the LLM layer.

## Features

- **Messaging Gateway** -- Chat with Claude through Discord, Telegram, or a built-in WebChat
- **Session Manager** -- Maintains conversation context across messages per channel/user
- **Cron Scheduling** -- Schedule recurring tasks with standard cron syntax
- **Heartbeat Daemon** -- Periodic autonomous check-ins using a configurable checklist
- **Webhooks** -- Trigger agent sessions from external services via HTTP
- **Canvas** -- Agent-driven visual workspace (HTML pushed to browser in real-time)
- **MCP Bridge** -- Claude sessions can send messages, update canvas, and manage memory

## Install

Inside a Claude Code instance, run the following commands:

**Step 1:** Add the marketplace
```
/plugin marketplace add Zollicoff/claude-claw
```

**Step 2:** Install the plugin
```
/plugin install claude-claw
```

**Step 3:** Run the setup
```
/claw-onboard
```

Done! This installs dependencies, builds the gateway, creates `~/.claude-claw/` with default workspace files, and installs the daemon service. No tokens or external accounts needed.

**Step 4** (optional): Start the gateway daemon
```
/claw-start
```

The gateway runs in API-only mode by default. To connect messaging platforms like Discord or Telegram, use `/claw-config` to add bot tokens when you're ready.

## Commands

| Command | Description |
|---------|-------------|
| `/claw-start` | Start the gateway daemon |
| `/claw-stop` | Stop the gateway daemon |
| `/claw-status` | Show daemon status, adapters, sessions |
| `/claw-config` | Configure adapters, tokens, ports, model |
| `/claw-onboard` | First-time setup wizard |
| `/claw-cron-add` | Schedule a recurring cron job |
| `/claw-cron-list` | List active cron jobs |
| `/claw-cron-remove` | Remove a cron job |
| `/claw-canvas` | Open the canvas workspace in browser |
| `/claw-send` | Send a message to a platform channel |
| `/claw-sessions` | List active conversation sessions |

## Architecture

```
Gateway Daemon (port 19789)
├── Channel Adapters (Discord, Telegram, WebChat)
├── Session Manager (spawns claude --print)
├── Scheduler (cron, heartbeat, webhooks)
├── Canvas Server (port 19793)
└── IPC Server (port 19790) <-- MCP bridge connects here

MCP Server (claw-bridge, stdio)
├── send_message, get_channels, get_history
├── canvas_update, canvas_clear
├── memory_read, memory_write, memory_search
└── claw_ping
```

## Configuration

State lives in `~/.claude-claw/`:

```
~/.claude-claw/
├── config.json          # Gateway config, tokens, ports
├── workspace/
│   ├── IDENTITY.md      # Agent name and role
│   ├── SOUL.md          # Personality and tone
│   ├── AGENTS.md        # Agent instructions
│   ├── USER.md          # User context
│   ├── MEMORY.md        # Persistent memory
│   └── HEARTBEAT.md     # Heartbeat checklist (optional)
├── sessions/            # Conversation session data
├── memory/              # Daily memory files
├── cron/                # Persistent cron job definitions
└── logs/                # Gateway and cron logs
```

## Platform Support

| Platform | Library | Status |
|----------|---------|--------|
| Discord | discord.js | Ready |
| Telegram | grammy | Ready |
| WebChat | Built-in | Ready |
| Slack | @slack/bolt | Planned |
| WhatsApp | Baileys | Planned |
| Signal | signal-cli | Planned |

## Daemon Management

**macOS:** LaunchAgent in `~/Library/LaunchAgents/ai.claude-claw.gateway.plist`
**Linux:** systemd user service in `~/.config/systemd/user/claude-claw-gateway.service`

Both auto-start on login and auto-restart on crash.

## Security

- Bot tokens stored in `~/.claude-claw/config.json` (chmod 600)
- Gateway binds to `127.0.0.1` only (no external exposure)
- Webhook endpoints require authentication tokens
- Canvas server is localhost-only
- No direct API calls -- uses `claude` CLI for authentication

## License

MIT
