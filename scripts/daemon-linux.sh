#!/bin/bash
# Generate and install the claude-claw systemd user service for Linux
set -e

SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_PATH="$SERVICE_DIR/claude-claw-gateway.service"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
GATEWAY_ENTRY="$PLUGIN_DIR/gateway/dist/index.js"
LOG_DIR="$HOME/.claude-claw/logs"
NODE_BIN=$(which node)

# Verify gateway is built
if [ ! -f "$GATEWAY_ENTRY" ]; then
    echo "Error: Gateway not built. Run 'npm run build' in $PLUGIN_DIR first."
    exit 1
fi

# Create directories
mkdir -p "$SERVICE_DIR" "$LOG_DIR"

cat > "$SERVICE_PATH" << EOF
[Unit]
Description=claude-claw Gateway Daemon
After=network.target

[Service]
Type=simple
ExecStart=${NODE_BIN} ${GATEWAY_ENTRY}
WorkingDirectory=${PLUGIN_DIR}
Restart=always
RestartSec=5
Environment=HOME=${HOME}
Environment=NODE_ENV=production
StandardOutput=append:${LOG_DIR}/gateway.log
StandardError=append:${LOG_DIR}/gateway.err.log

[Install]
WantedBy=default.target
EOF

# Reload systemd
systemctl --user daemon-reload

echo "systemd service written to $SERVICE_PATH"
echo ""
echo "To start the daemon:"
echo "  systemctl --user start claude-claw-gateway"
echo ""
echo "To enable on login:"
echo "  systemctl --user enable claude-claw-gateway"
echo ""
echo "To stop the daemon:"
echo "  systemctl --user stop claude-claw-gateway"
echo ""
echo "Logs at: $LOG_DIR/gateway.log"
