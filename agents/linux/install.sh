#!/usr/bin/env bash
set -euo pipefail

# Minimal installer for UltraLock clipwatch prototype (Linux/X11)
# Usage: sudo ./install.sh (installs to /usr/local/bin)

BIN=clipwatch
SRC=clipwatch.c
DEST=/usr/local/bin/$BIN

echo "Building $BIN..."
if ! command -v gcc >/dev/null; then
  echo "gcc not found. Please install build-essential or equivalent." >&2; exit 1
fi

gcc -o $BIN $SRC -lX11 -lm -lcrypto
sudo mv $BIN $DEST
sudo chmod 755 $DEST

echo "Installed $DEST"

echo "You can run the agent with: $DEST"

echo "Optionally configure a systemd user service:"
cat <<'EOF'
[Unit]
Description=UltraLock clipwatch agent (user)

[Service]
ExecStart=/usr/local/bin/clipwatch
Restart=on-failure

[Install]
WantedBy=default.target
EOF

echo "To enable: copy above to ~/.config/systemd/user/ultralock.service and run: systemctl --user enable --now ultralock.service"
