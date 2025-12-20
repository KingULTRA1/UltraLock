#!/usr/bin/env bash
# Test the helper: start agent & bridge, then use helper to bind address, then verify LIST shows FP
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
CLIP="$ROOT/agents/linux/clipwatch"
BRIDGE="$ROOT/agents/linux/bridge"
HELP="$ROOT/agents/linux/helper"
IPC="$ROOT/agents/linux/ipc_cli.sh"
TEST_ADDR="bc1qw9cqf600jzcvkd53lpf6j9w93x806z5x5c0t8q"

gcc -o "$CLIP" "$ROOT/agents/linux/clipwatch.c" -lX11 -lm -O2 || true
gcc -o "$BRIDGE" "$ROOT/agents/linux/bridge.c" -O2 || true
gcc -o "$HELP" "$ROOT/agents/linux/helper.c" -O2 || true

# start clipwatch in daemon mode
"$CLIP" --daemon >/tmp/ultralock-clip.log 2>&1 &
CLIP_PID=$!
sleep 0.5

# start bridge
TMPOUT=$(mktemp)
"$BRIDGE" > "$TMPOUT" 2>&1 &
BRIDGE_PID=$!
# wait for startup
sleep 0.5

# run helper (automate confirmation with YES)
printf "YES\n" | "$HELP" bindaddr "$TEST_ADDR" > /tmp/helper_out.txt 2>&1

# verify LIST
FOUND=0
for i in {1..40}; do
    LIST_OUT=$("$IPC" LIST 2>/dev/null || true)
    if echo "$LIST_OUT" | grep -q "FP "; then FOUND=1; break; fi
    sleep 0.05
done

if [ "$FOUND" -eq 1 ]; then
    echo "address is safe and passed"
    kill $BRIDGE_PID $CLIP_PID || true
    rm -f "$TMPOUT"
    exit 0
else
    echo "LIST did not show FP"; cat /tmp/helper_out.txt; kill $BRIDGE_PID $CLIP_PID || true; exit 2
fi
