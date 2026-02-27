---
description: Schedule a new cron job for the claude-claw agent
argument-hint: <schedule> <task description>
allowed-tools: [Bash, AskUserQuestion]
---

# Add Cron Job

Schedule a recurring task for the claude-claw agent.

## Arguments

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the arguments. The first argument should be a cron schedule (e.g., `*/30 * * * *`), and the rest is the task description.

2. If arguments are missing, use AskUserQuestion to get:
   - Schedule (cron syntax, e.g., `*/30 * * * *` for every 30 minutes)
   - Task description (what Claude should do when it fires)

3. Send the job to the gateway:
   ```
   curl -s -X POST http://127.0.0.1:19789/api/cron \
     -H 'Content-Type: application/json' \
     -d '{"schedule": "<cron>", "task": "<description>"}'
   ```

4. If the gateway is not running, report that and suggest `/claw-start`.

5. Report success with the job ID and next scheduled run time.
