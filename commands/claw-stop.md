---
description: Stop the claude-claw gateway daemon
allowed-tools: [Bash]
---

# Stop Gateway Daemon

Stop the claude-claw gateway daemon.

## Instructions

1. Try graceful shutdown via the API:
   ```
   curl -s -X POST http://127.0.0.1:19789/api/shutdown 2>/dev/null
   ```

2. If that fails (daemon not responding), try platform-specific stop:

   **macOS:**
   ```
   launchctl unload ~/Library/LaunchAgents/ai.claude-claw.gateway.plist 2>/dev/null
   ```

   **Linux:**
   ```
   systemctl --user stop claude-claw-gateway 2>/dev/null
   ```

3. If both fail, try killing the process:
   ```
   pkill -f "node.*claude-claw.*gateway" 2>/dev/null
   ```

4. Verify the daemon is stopped:
   ```
   curl -s http://127.0.0.1:19789/api/status 2>/dev/null
   ```
   If it no longer responds, the daemon is stopped.

5. Report the result to the user.
