#!/bin/bash
# Generate and install the claude-claw LaunchAgent plist for macOS
set -e

PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/ai.claude-claw.gateway.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
GATEWAY_ENTRY="$PLUGIN_DIR/gateway/dist/index.js"
LOG_DIR="$HOME/.claude-claw/logs"
NODE_BIN=$(which node)
CLAUDE_BIN=$(which claude 2>/dev/null || echo "")

# Verify gateway is built
if [ ! -f "$GATEWAY_ENTRY" ]; then
    echo "Error: Gateway not built. Run 'npm run build' in $PLUGIN_DIR first."
    exit 1
fi

# Create directories
mkdir -p "$PLIST_DIR" "$LOG_DIR"

# Build PATH that includes both node and claude
PATH_DIRS="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
[ -d "/opt/homebrew/bin" ] && PATH_DIRS="/opt/homebrew/bin:$PATH_DIRS"
[ -n "$CLAUDE_BIN" ] && PATH_DIRS="$(dirname "$CLAUDE_BIN"):$PATH_DIRS"

# Also include the Claude Code application support path
CLAUDE_CODE_DIR="$HOME/Library/Application Support/Claude/claude-code"
if [ -d "$CLAUDE_CODE_DIR" ]; then
    LATEST=$(ls -t "$CLAUDE_CODE_DIR" 2>/dev/null | head -1)
    if [ -n "$LATEST" ] && [ -d "$CLAUDE_CODE_DIR/$LATEST" ]; then
        PATH_DIRS="$CLAUDE_CODE_DIR/$LATEST:$PATH_DIRS"
    fi
fi

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.claude-claw.gateway</string>

    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${GATEWAY_ENTRY}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${PLUGIN_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/gateway.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/gateway.err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>${PATH_DIRS}</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
EOF

echo "LaunchAgent plist written to $PLIST_PATH"
echo ""
echo "To start the daemon:"
echo "  launchctl load $PLIST_PATH"
echo ""
echo "To stop the daemon:"
echo "  launchctl unload $PLIST_PATH"
echo ""
echo "Logs at: $LOG_DIR/gateway.log"
