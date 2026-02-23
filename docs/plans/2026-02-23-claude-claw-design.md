# claude-claw Design Document

**Date:** 2026-02-23
**Status:** Approved
**Author:** Zollicoff + Claude

## Overview

claude-claw is a Claude Code plugin suite that brings OpenClaw's core capabilities natively into Claude Code. Instead of running a separate third-party agent that calls LLM APIs directly, claude-claw runs as a plugin inside Claude Code's ecosystem — using the `claude` CLI itself as the LLM layer.

### Goals

- Messaging platform integration (Discord primary, plus Telegram, Slack, WhatsApp, Signal, Teams, etc.)
- Autonomous agent capabilities (heartbeat daemon, cron scheduling, webhooks)
- Canvas visual workspace (agent-driven HTML UI in the browser)
- Full OpenClaw feature parity (excluding voice in v1)
- macOS first, Linux second (mostly universal — only daemon management differs)

### Non-Goals (v1)

- Voice/speech capabilities (STT, TTS, talk mode)
- Moltbook-style agent social networking
- Multi-agent routing (single agent per gateway for v1)

## Architecture

Monolithic plugin bundling all components. The Gateway daemon is a persistent background Node.js process. Claude Code sessions are spawned via the `claude` CLI in headless mode to handle AI work.

```
┌─────────────────────────────────────────────────────┐
│                   claude-claw plugin                │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │  Skills   │  │  Hooks   │  │  MCP Server       │ │
│  │ /claw-*   │  │ Session  │  │ (claw-bridge)     │ │
│  │ commands  │  │ Start/   │  │ query gateway,    │ │
│  │           │  │ Stop     │  │ send msgs, manage │ │
│  └──────────┘  └──────────┘  │ schedules, canvas │ │
│                               └────────┬──────────┘ │
│                                        │ IPC        │
│  ┌─────────────────────────────────────┴──────────┐ │
│  │            Gateway Daemon (Node.js)            │ │
│  │                 (port 18789)                    │ │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────────────┐ │ │
│  │  │Adapters │ │Scheduler │ │  Canvas Server  │ │ │
│  │  │Discord  │ │Cron      │ │  (port 18793)   │ │ │
│  │  │Telegram │ │Heartbeat │ │  WebSocket +    │ │ │
│  │  │Slack    │ │Webhooks  │ │  HTML serving   │ │ │
│  │  │Signal   │ │          │ │                 │ │ │
│  │  │WhatsApp │ │          │ │                 │ │ │
│  │  │...      │ │          │ │                 │ │ │
│  │  └────┬────┘ └────┬─────┘ └────────┬────────┘ │ │
│  │       │           │                │           │ │
│  │  ┌────┴───────────┴────────────────┴────────┐  │ │
│  │  │         Session Manager                  │  │ │
│  │  │  Spawns `claude` CLI for each inbound    │  │ │
│  │  │  conversation. Routes responses back.    │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Message Flow

1. Message arrives on Discord (or any platform)
2. Gateway daemon receives it via the platform adapter
3. Session Manager spawns a headless `claude` CLI session (or reuses an existing one for that conversation)
4. Claude Code processes the message and produces a response
5. Gateway routes the response back to the originating platform
6. If Claude calls `claw-bridge` MCP tools during its session (send message, update Canvas, schedule task), the MCP server relays those to the Gateway via IPC

### LLM Layer

The Gateway spawns the actual `claude` CLI binary in headless mode. Claude Code handles its own authentication — no direct API calls, no SDK, no OAuth token extraction. The daemon orchestrates *when* and *what* to send to `claude`, not *how* to authenticate.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Package manager:** npm
- **Gateway:** Express or Fastify for webhook HTTP endpoints, ws for WebSocket
- **Discord:** discord.js
- **Telegram:** grammy
- **Slack:** @slack/bolt
- **WhatsApp:** Baileys
- **Signal:** signal-cli bridge
- **Canvas:** WebSocket server serving agent-driven HTML
- **Daemon management:** LaunchAgent (macOS), systemd user service (Linux)

## Plugin Structure

```
claude-claw/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   ├── claw-start/SKILL.md      # Start the Gateway daemon
│   ├── claw-stop/SKILL.md       # Stop the Gateway daemon
│   ├── claw-status/SKILL.md     # Show daemon status
│   ├── claw-config/SKILL.md     # Interactive configuration
│   ├── claw-onboard/SKILL.md    # First-time setup wizard
│   ├── claw-cron-add/SKILL.md   # Schedule a cron job
│   ├── claw-cron-list/SKILL.md  # List cron jobs
│   ├── claw-cron-remove/SKILL.md # Remove a cron job
│   ├── claw-canvas/SKILL.md     # Open Canvas in browser
│   ├── claw-send/SKILL.md       # Send message to a channel
│   └── claw-sessions/SKILL.md   # List/manage sessions
├── hooks/
│   └── hooks.json               # SessionStart hook for daemon status
├── .mcp.json                    # MCP server config (claw-bridge)
├── gateway/
│   ├── src/
│   │   ├── index.ts             # Gateway entry point
│   │   ├── server.ts            # HTTP + WebSocket server
│   │   ├── session-manager.ts   # Claude CLI session lifecycle
│   │   ├── adapters/
│   │   │   ├── adapter.ts       # Common adapter interface
│   │   │   ├── discord.ts       # Discord adapter
│   │   │   ├── telegram.ts      # Telegram adapter
│   │   │   ├── slack.ts         # Slack adapter
│   │   │   ├── whatsapp.ts      # WhatsApp adapter
│   │   │   ├── signal.ts        # Signal adapter
│   │   │   └── webchat.ts       # WebChat adapter
│   │   ├── scheduler/
│   │   │   ├── cron.ts          # Cron job manager
│   │   │   ├── heartbeat.ts     # Heartbeat daemon
│   │   │   └── webhooks.ts      # Webhook handler
│   │   └── canvas/
│   │       ├── server.ts        # Canvas WebSocket server (port 18793)
│   │       └── client.html      # Canvas browser client
│   ├── package.json
│   └── tsconfig.json
├── mcp-server/
│   ├── src/
│   │   └── index.ts             # claw-bridge MCP server
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   ├── install.sh               # Install dependencies
│   ├── daemon-macos.sh          # LaunchAgent setup
│   └── daemon-linux.sh          # systemd setup
├── docs/
│   └── plans/
│       └── 2026-02-23-claude-claw-design.md
├── package.json                 # Root workspace
└── README.md
```

## Component Details

### 1. Gateway Daemon

Single Node.js process on `127.0.0.1:18789`. Manages all platform connections, session routing, scheduling, and Canvas.

**State directory:** `~/.claude-claw/`

```
~/.claude-claw/
├── config.json          # Gateway config, ports, enabled adapters, tokens
├── workspace/
│   ├── AGENTS.md        # Agent instructions
│   ├── IDENTITY.md      # Name, avatar, introduction style
│   ├── SOUL.md          # Personality, tone, philosophy
│   ├── USER.md          # User context and preferences
│   └── MEMORY.md        # Persistent agent memory
├── sessions/            # Conversation history per channel
├── memory/              # Daily memory files (YYYY-MM-DD.md)
└── cron/                # Persistent scheduled jobs
```

### 2. Channel Adapters

Common interface for all platform adapters:

```typescript
interface ChannelAdapter {
  name: string
  connect(config: AdapterConfig): Promise<void>
  disconnect(): Promise<void>
  sendMessage(channelId: string, message: Message): Promise<void>
  onMessage(handler: MessageHandler): void
  getChannels(): Promise<Channel[]>
}

interface Message {
  id: string
  content: string
  author: { id: string; name: string; platform: string }
  channelId: string
  platform: string
  timestamp: Date
  replyTo?: string
  attachments?: Attachment[]
}

type MessageHandler = (message: Message) => Promise<void>
```

**Implementation priority:**
1. Discord (discord.js) — primary testing target
2. Telegram (grammy)
3. Slack (@slack/bolt)
4. WhatsApp (Baileys)
5. Signal (signal-cli)
6. WebChat (built-in, simple HTTP + WebSocket)

### 3. Session Manager

Manages the lifecycle of `claude` CLI sessions:

- **Spawning:** Runs `claude --headless` with appropriate context (CLAUDE.md injected with platform/channel/user info)
- **Conversation mapping:** Each platform conversation (e.g., Discord channel + user) maps to a persistent Claude session
- **Session reuse:** Resumes existing sessions for ongoing conversations
- **Timeout:** Sessions idle for >30 minutes are cleaned up
- **Concurrency:** Handles multiple simultaneous conversations across platforms
- **Context injection:** Each session gets the workspace files (AGENTS.md, IDENTITY.md, SOUL.md, USER.md, MEMORY.md) as context

### 4. Scheduler

**Heartbeat:**
- Configurable interval (default: 30 minutes)
- Reads `~/.claude-claw/workspace/HEARTBEAT.md` — a checklist of monitoring tasks
- Spawns a fresh `claude` session each heartbeat
- Agent acts on items or returns `HEARTBEAT_OK`

**Cron Jobs:**
- Persistent job definitions in `~/.claude-claw/cron/`
- Standard cron syntax
- Each job fires a fresh, isolated `claude` session (no conversation carry-over)
- Survives daemon restarts and reboots

**Webhooks:**
- HTTP endpoint: `http://localhost:18789/webhooks/:id`
- External services trigger agent actions via POST
- Configurable payload templates per webhook

### 5. Canvas

Agent-driven visual workspace (A2UI pattern from OpenClaw):

- Separate server process on port `18793` (isolated from Gateway)
- Serves HTML content via WebSocket to connected browser clients
- Claude pushes HTML during any session via `claw-bridge` MCP tools
- Real-time rendering in browser

### 6. MCP Server (claw-bridge)

Bridge between Claude Code sessions and the Gateway daemon. Communicates via IPC (Unix socket or localhost HTTP).

**Messaging tools:**
- `send_message(platform, channel, message)` — send to any connected platform
- `get_channels()` — list available channels across all platforms
- `get_history(platform, channel, limit)` — fetch recent conversation history

**Scheduler tools:**
- `cron_create(schedule, task, description)` — create a cron job
- `cron_list()` — list scheduled jobs
- `cron_delete(id)` — remove a job

**Canvas tools:**
- `canvas_update(html)` — push HTML to Canvas
- `canvas_clear()` — clear the Canvas

**Memory tools:**
- `memory_read(key)` — read from persistent memory
- `memory_write(key, value)` — write to persistent memory
- `memory_search(query)` — search across memory files

### 7. Skills

| Skill | Description |
|-------|-------------|
| `/claw-start` | Start the Gateway daemon (detects OS, installs LaunchAgent/systemd) |
| `/claw-stop` | Stop the Gateway daemon |
| `/claw-status` | Show daemon status, connected platforms, active sessions |
| `/claw-config` | Interactive configuration (add bot tokens, set ports, enable adapters) |
| `/claw-onboard` | First-time setup wizard |
| `/claw-cron-add` | Schedule a new cron job |
| `/claw-cron-list` | List active cron jobs |
| `/claw-cron-remove` | Remove a cron job |
| `/claw-canvas` | Open Canvas in browser |
| `/claw-send` | Send a message to a specific channel |
| `/claw-sessions` | List/manage active conversation sessions |

### 8. Hooks

**SessionStart hook:** Checks if the Gateway daemon is running and displays status in the Claude Code session. Non-blocking, informational only.

## Platform Support

| Platform | Daemon Management | Notes |
|----------|-------------------|-------|
| macOS (primary) | LaunchAgent plist in `~/Library/LaunchAgents/` | Auto-start on login |
| Linux | systemd user service in `~/.config/systemd/user/` | Auto-start on login |

The Gateway code itself is platform-universal. Only the daemon lifecycle scripts differ.

## OpenClaw Feature Mapping

| OpenClaw Feature | claude-claw Equivalent | Status |
|-----------------|----------------------|--------|
| Gateway (port 18789) | Gateway daemon (port 18789) | v1 |
| 15+ messaging platforms | Adapter system (Discord first) | v1 |
| Skills (SKILL.md + ClawHub) | Claude Code skills system | v1 |
| Heartbeat daemon | Heartbeat scheduler | v1 |
| Cron jobs | Cron scheduler | v1 |
| Webhooks | Webhook HTTP endpoints | v1 |
| Canvas (A2UI, port 18793) | Canvas server (port 18793) | v1 |
| AGENTS.md / IDENTITY.md / SOUL.md / USER.md / MEMORY.md | Workspace config files | v1 |
| Memory (daily + long-term + search) | Memory files + MCP tools | v1 |
| Multi-agent routing | Single agent | v2 |
| Voice (STT/TTS/Talk Mode) | Not included | v2 |
| Moltbook integration | Not included | Out of scope |
| NanoClaw (container isolation) | Not included | v2+ |

## Security Considerations

- Bot tokens stored in `~/.claude-claw/config.json` (user-readable only, chmod 600)
- Gateway binds to `127.0.0.1` only (no external exposure by default)
- Webhook endpoints require authentication tokens
- Canvas server binds to localhost only
- No OAuth token extraction or subscription auth bypass — uses `claude` CLI directly
