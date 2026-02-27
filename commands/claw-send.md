---
description: Send a message to a specific platform channel via the gateway
argument-hint: <platform>:<channel> <message>
allowed-tools: [Bash, AskUserQuestion]
---

# Send Message

Send a message through the claude-claw gateway to a specific platform and channel.

## Arguments

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the arguments. Expected format: `platform:channel message text here`
   - Example: `discord:123456789 Hello from claw!`
   - Example: `telegram:987654321 Check this out`

2. If arguments are missing or malformed, use AskUserQuestion to get:
   - Platform (discord, telegram, webchat)
   - Channel ID
   - Message content

3. Send the message:
   ```
   curl -s -X POST http://127.0.0.1:19789/api/send \
     -H 'Content-Type: application/json' \
     -d '{"platform": "<platform>", "channel": "<channel>", "message": "<message>"}'
   ```

4. If the gateway is not running, report that and suggest `/claw-start`.

5. Report success or failure.
