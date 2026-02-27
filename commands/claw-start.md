---
description: Start the claude-claw gateway daemon
allowed-tools: [Bash, Read, Write]
---

# Start Gateway Daemon

Start the claude-claw gateway daemon as a background service.

## Context

- Plugin directory: the root of the claude-claw plugin (where this command lives)
- Config: ~/.claude-claw/config.json
- Gateway port: 19789

## Instructions

1. Check if the gateway is already running:
   ```
   curl -s http://127.0.0.1:19789/api/status 2>/dev/null
   ```
   If it responds, report that the daemon is already running with its status and exit.

2. Check if dependencies are installed:
   ```
   ls node_modules/.package-lock.json 2>/dev/null
   ```
   If not found, suggest running `/claw-onboard` first.

3. Check if the gateway is built:
   ```
   ls gateway/dist/index.js 2>/dev/null
   ```
   If not found, run `npm run build`.

4. Detect the platform and start the daemon:

   **macOS:**
   - Check if LaunchAgent plist exists: `ls ~/Library/LaunchAgents/ai.claude-claw.gateway.plist 2>/dev/null`
   - If exists: `launchctl load ~/Library/LaunchAgents/ai.claude-claw.gateway.plist`
   - If not: run `bash scripts/daemon-macos.sh` to generate the plist first, then load it

   **Linux:**
   - Check if systemd service exists: `ls ~/.config/systemd/user/claude-claw-gateway.service 2>/dev/null`
   - If exists: `systemctl --user start claude-claw-gateway`
   - If not: run `bash scripts/daemon-linux.sh` to generate the service first, then start it

5. Wait 3 seconds, then verify:
   ```
   sleep 3 && curl -s http://127.0.0.1:19789/api/status
   ```

6. Report the result to the user.
