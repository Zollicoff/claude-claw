---
description: Show claude-claw gateway daemon status
allowed-tools: [Bash]
---

# Claw Status

Check the status of the claude-claw gateway daemon.

## Context

- Gateway port: 19789
- IPC port: 19790
- Canvas port: 19793

## Instructions

1. Check if the gateway is running by hitting the status endpoint:
   ```
   curl -s http://127.0.0.1:19789/api/status 2>/dev/null
   ```

2. If the gateway responds, parse and display:
   - Daemon status (running/stopped)
   - Uptime
   - Connected adapters
   - Active sessions count

3. If the gateway does not respond, report that it is not running and suggest using `/claw-start` to start it.

4. Also check if the canvas server is running:
   ```
   curl -s http://127.0.0.1:19793/ >/dev/null 2>&1 && echo "Canvas: running" || echo "Canvas: stopped"
   ```

5. Present a clean summary to the user.
