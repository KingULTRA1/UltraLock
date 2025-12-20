#!/usr/bin/env bash
# install_systemd.sh — installs UltraLock agent and bridge as user services
set -euo pipefail
BIN_DIR="$HOME/.local/bin"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$BIN_DIR" "$UNIT_DIR"

# Copy built binaries if present
if [ -f "agents/linux/clipwatch" ]; then
  cp -f agents/linux/clipwatch "$BIN_DIR/clipwatch"
  chmod 0755 "$BIN_DIR/clipwatch"
  echo "Installed clipwatch -> $BIN_DIR/clipwatch"
else
  echo "Warning: built binary agents/linux/clipwatch not found. Please build first or place your binary at $BIN_DIR/clipwatch"
fi
if [ -f "agents/linux/bridge" ]; then
  cp -f agents/linux/bridge "$BIN_DIR/bridge"
  chmod 0755 "$BIN_DIR/bridge"
  echo "Installed bridge -> $BIN_DIR/bridge"
else
  echo "Warning: built binary agents/linux/bridge not found. Please build first or place your binary at $BIN_DIR/bridge"
fi
if [ -f "agents/linux/helper" ]; then
  cp -f agents/linux/helper "$BIN_DIR/helper"
  chmod 0755 "$BIN_DIR/helper"
  echo "Installed helper -> $BIN_DIR/helper"
else
  echo "Note: helper binary agents/linux/helper not found. Build with: gcc -o agents/linux/helper agents/linux/helper.c"
fi

# Install unit files
cp -f agents/linux/systemd/ultralock-agent.service "$UNIT_DIR/ultralock-agent.service"
cp -f agents/linux/systemd/ultralock-bridge.service "$UNIT_DIR/ultralock-bridge.service"
chmod 0644 "$UNIT_DIR/ultralock-agent.service" "$UNIT_DIR/ultralock-bridge.service"

echo "Installed user unit files to $UNIT_DIR"

# Reload and enable (if systemctl is available)
if command -v systemctl >/dev/null 2>&1; then
  echo "Reloading user systemd daemon and enabling services..."
  systemctl --user daemon-reload
  echo "To enable and start now, run:"
  echo "  systemctl --user enable --now ultralock-agent ultralock-bridge"
else
  echo "systemctl not found. When available, run the following to finish installation:"
  echo "  systemctl --user daemon-reload"
  echo "  systemctl --user enable --now ultralock-agent ultralock-bridge"
fi

echo "Done. See README.md for verification steps."