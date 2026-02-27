---
description: List active cron jobs scheduled for the claude-claw agent
allowed-tools: [Bash]
---

# List Cron Jobs

## Instructions

1. Query the gateway for active cron jobs:
   ```
   curl -s http://127.0.0.1:19789/api/cron 2>/dev/null
   ```

2. If the gateway is not running, fall back to reading job files directly:
   ```
   ls ~/.claude-claw/cron/*.json 2>/dev/null
   ```
   And read each file to display its contents.

3. Format the output as a table showing:
   - Job ID
   - Schedule (cron expression)
   - Task description
   - Last run time
   - Next run time

4. If no jobs exist, report that and suggest `/claw-cron-add`.
