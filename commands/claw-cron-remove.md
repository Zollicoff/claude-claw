---
description: Remove a scheduled cron job
argument-hint: <job-id>
allowed-tools: [Bash, AskUserQuestion]
---

# Remove Cron Job

## Arguments

The user invoked this command with: $ARGUMENTS

## Instructions

1. If no job ID provided, first list jobs:
   ```
   curl -s http://127.0.0.1:19789/api/cron 2>/dev/null
   ```
   Then use AskUserQuestion to ask which job to remove.

2. Delete the job:
   ```
   curl -s -X DELETE http://127.0.0.1:19789/api/cron/<job-id> 2>/dev/null
   ```

3. If the gateway is not running, delete the file directly:
   ```
   rm ~/.claude-claw/cron/<job-id>.json
   ```

4. Report success.
