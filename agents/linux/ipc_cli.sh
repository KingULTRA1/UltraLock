#!/usr/bin/env bash
# ipc_cli.sh — simple helper to talk to UltraLock unix socket (BIND/UNBIND/LIST)
# Usage: ./ipc_cli.sh LIST
#        ./ipc_cli.sh "BIND <fp>"
#        ./ipc_cli.sh "UNBIND <fp>"

set -euo pipefail
CMD="${1:-LIST}"
SOCK="${XDG_RUNTIME_DIR:-$HOME/.local/share}/ultralock.sock"
if command -v nc >/dev/null 2>&1; then
    # Use netcat with unix domain socket support (-U)
    if nc -h 2>&1 | grep -q -- "-U"; then
        echo -e "$CMD" | nc -U "$SOCK"
        exit 0
    fi
fi
if command -v socat >/dev/null 2>&1; then
    echo -e "$CMD" | socat - UNIX-CONNECT:"$SOCK"
    exit 0
fi
# Fallback: try python3 then python (some systems have only python3)
if command -v python3 >/dev/null 2>&1; then
    python3 - <<PY3_EOF 2>/dev/null
import socket,sys
s=socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.connect(("$SOCK"))
s.sendall(b"$CMD\n")
print(s.recv(4096).decode(), end='')
PY3_EOF
    exit 0
fi
if command -v python >/dev/null 2>&1; then
    python - <<PY_EOF 2>/dev/null
import socket,sys
s=socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.connect(("$SOCK"))
s.sendall(b"$CMD\n")
print(s.recv(4096).decode(), end='')
PY_EOF
    exit 0
fi

echo "No suitable tool found (need nc with -U, socat, or python)." >&2
exit 2
