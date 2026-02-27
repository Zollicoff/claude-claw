---
description: Open the claude-claw canvas visual workspace in the browser
allowed-tools: [Bash]
---

# Open Canvas

Open the claude-claw canvas (agent-driven visual workspace) in the default browser.

## Instructions

1. Check if the canvas server is running:
   ```
   curl -s http://127.0.0.1:19793/ >/dev/null 2>&1
   ```

2. If not running, check if the gateway is running:
   ```
   curl -s http://127.0.0.1:19789/api/status 2>/dev/null
   ```
   If the gateway is not running, suggest `/claw-start`. If the gateway is running but canvas is not, it may not be enabled in the config.

3. Open the canvas in the browser:

   **macOS:**
   ```
   open http://127.0.0.1:19793
   ```

   **Linux:**
   ```
   xdg-open http://127.0.0.1:19793
   ```

4. Report that the canvas is open. Mention that Claude can push HTML to it using the `canvas_update` MCP tool during any session.
