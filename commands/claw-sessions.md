---
description: List and manage active claude-claw conversation sessions
allowed-tools: [Bash]
---

# Manage Sessions

List active conversation sessions managed by the claude-claw gateway.

## Instructions

1. Query the gateway for active sessions:
   ```
   curl -s http://127.0.0.1:19789/api/sessions 2>/dev/null
   ```

2. If the gateway is not running, report that and suggest `/claw-start`.

3. Format the output as a table showing:
   - Platform
   - Channel ID
   - User ID
   - Session ID (first 8 chars)
   - Last active time

4. If no sessions exist, report that no conversations are active.
