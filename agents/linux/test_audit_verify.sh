#!/usr/bin/env bash
# Audit-chain verification test: ensures audit_verify program detects intact and tampered logs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
CLIP="$ROOT/agents/linux/clipwatch"
BRIDGE="$ROOT/agents/linux/bridge"
VERIFY="$ROOT/agents/linux/audit_verify"
IPC="$ROOT/agents/linux/ipc_cli.sh"
TEST_ADDR="bc1qw9cqf600jzcvkd53lpf6j9w93x806z5x5c0t8q"

# Build
gcc -o "$CLIP" "$ROOT/agents/linux/clipwatch.c" -lX11 -lm -O2 || true
gcc -o "$BRIDGE" "$ROOT/agents/linux/bridge.c" -O2 || true
gcc -o "$VERIFY" "$ROOT/agents/linux/audit_verify.c" -O2 || true

# determine audit path
if [ -n "${XDG_RUNTIME_DIR-}" ]; then AUDIT="$XDG_RUNTIME_DIR/ultralock_audit.log"; else AUDIT="$HOME/.local/share/ultralock_audit.log"; fi
# backup existing audit log to ensure a clean run
if [ -f "$AUDIT" ]; then mv "$AUDIT" "$AUDIT.bak" || true; fi

# start clipwatch and bridge
"$CLIP" --daemon >/tmp/ultralock-clip.log 2>&1 &
CLIP_PID=$!
sleep 0.2
TMPOUT=$(mktemp)
"$BRIDGE" > "$TMPOUT" 2>&1 &
BRIDGE_PID=$!
sleep 0.2
PORT=$(grep -oP "127\\.0\\.0\\.1:\K\\d+" "$TMPOUT" | head -n1)
TOKEN=$(grep -oP "Token: \K[0-9a-f]+" "$TMPOUT" | head -n1)

curl -s "http://127.0.0.1:$PORT/bindaddr?address=$TEST_ADDR&token=$TOKEN" >/tmp/bridge_res.txt
# wait for audit entries to appear
sleep 0.1

if [ ! -f "$AUDIT" ]; then echo "audit file missing"; kill $BRIDGE_PID $CLIP_PID || true; exit 2; fi

# verify clean log passes
if "$VERIFY" >/tmp/verify_out.txt 2>&1; then
    grep -q "audit OK" /tmp/verify_out.txt || (cat /tmp/verify_out.txt; kill $BRIDGE_PID $CLIP_PID || true; exit 2)
else
    cat /tmp/verify_out.txt; kill $BRIDGE_PID $CLIP_PID || true; exit 2
fi

# tamper the log (modify last line)
sed -i '$ s/./0/' "$AUDIT"
# verify tampered log fails
if "$VERIFY" >/tmp/verify_out2.txt 2>&1; then
    echo "audit_verify unexpectedly succeeded on tampered log"; cat /tmp/verify_out2.txt; kill $BRIDGE_PID $CLIP_PID || true; exit 2
else
    grep -q "FAILED" /tmp/verify_out2.txt || (cat /tmp/verify_out2.txt; kill $BRIDGE_PID $CLIP_PID || true; exit 2)
fi

# cleanup
kill $BRIDGE_PID $CLIP_PID || true
rm -f "$TMPOUT"
# restore original audit log if present
if [ -f "$AUDIT.bak" ]; then mv "$AUDIT.bak" "$AUDIT" || true; fi
echo "address is safe and passed"
