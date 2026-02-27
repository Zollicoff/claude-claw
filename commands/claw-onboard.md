---
description: First-time setup for claude-claw
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# Claw Onboard

Set up claude-claw. This runs automatically after plugin install.

## Step 1: Prerequisites

Check required tools:
```
node --version
npm --version
```

Node must be >= 20. If missing, tell the user what to install and stop.

## Step 2: Install & Build

From the plugin directory (use `${CLAUDE_PLUGIN_ROOT}` or detect from this file's location):
```
cd <plugin-dir> && npm install && npm run build
```

If this fails, report the error and stop.

## Step 3: Create State Directory

```
mkdir -p ~/.claude-claw/workspace ~/.claude-claw/sessions ~/.claude-claw/memory ~/.claude-claw/cron ~/.claude-claw/logs
```

## Step 4: Initialize Workspace Files

Create default workspace files in ~/.claude-claw/workspace/ **only if they don't already exist** (don't overwrite existing files):

**IDENTITY.md:**
```markdown
# Identity
Name: Claude
Role: AI assistant via claude-claw
```

**SOUL.md:**
```markdown
# Soul
You are helpful, concise, and friendly in chat conversations.
Keep responses brief unless asked for detail.
Use natural conversational language.
```

**AGENTS.md:**
```markdown
# Agent Instructions
You are responding to messages via the claude-claw gateway.
You have access to MCP tools for sending messages, managing the canvas, and reading/writing memory.
```

**USER.md:**
```markdown
# User Context
```

**MEMORY.md:**
```markdown
# Memory
```

## Step 5: Install Daemon Service

Detect the OS and install the daemon:

**macOS:**
```
bash <plugin-dir>/scripts/daemon-macos.sh
```

**Linux:**
```
bash <plugin-dir>/scripts/daemon-linux.sh
```

## Step 6: Report

Show the user a clean summary:

```
claude-claw setup complete!

  Config:    ~/.claude-claw/config.json
  Workspace: ~/.claude-claw/workspace/
  Logs:      ~/.claude-claw/logs/

Next steps:
  /claw-start          Start the gateway daemon
  /claw-status         Check daemon status
  /claw-config discord Add a Discord bot (optional)
  /claw-canvas         Open the visual workspace
```

Do NOT prompt for bot tokens or adapter configuration. The gateway works in API-only mode by default. Users add platform adapters later with `/claw-config` when they're ready.
