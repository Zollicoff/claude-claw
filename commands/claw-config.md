---
description: Configure claude-claw settings (adapters, tokens, ports)
argument-hint: [discord|telegram|webchat|port|model|session|show]
allowed-tools: [Bash, Read, Write, Edit, AskUserQuestion]
---

# Claw Configuration

Configure claude-claw settings interactively.

## Arguments

The user invoked this command with: $ARGUMENTS

## Context

- Config file: ~/.claude-claw/config.json

## Instructions

First, read the current config:
```
cat ~/.claude-claw/config.json 2>/dev/null || echo "No config found"
```

Based on the arguments or user intent:

### `show` or no arguments
Display the current configuration in a readable format. Mask bot tokens (show first 10 chars + "...").

### `discord`
Use AskUserQuestion to get the Discord bot token from the user. Update `adapters.discord.token` in config.json. Optionally ask for allowed channel IDs.

### `telegram`
Use AskUserQuestion to get the Telegram bot token. Update `adapters.telegram.token` in config.json.

### `webchat`
Toggle `adapters.webchat.enabled` in config.json.

### `port`
Use AskUserQuestion to get the new gateway port. Update `gateway.port` in config.json. Warn that the daemon needs to be restarted.

### `model`
Use AskUserQuestion to get the preferred model (sonnet, opus, haiku). Update `session.model` in config.json.

### `session`
Configure session settings: timeout, max concurrent sessions, permission mode. Use AskUserQuestion for each.

After making changes, write the updated config to ~/.claude-claw/config.json and report what was changed. Remind the user to restart the daemon (`/claw-stop` then `/claw-start`) for changes to take effect.
