#!/usr/bin/env bash
# Persistence integration test: bind an address, restart the agent, ensure LIST still shows the FP
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
CLIP="$ROOT/agents/linux/clipwatch"
BRIDGE="$ROOT/agents/linux/bridge"
IPC="$ROOT/agents/linux/ipc_cli.sh"
TEST_ADDR="bc1qw9cqf600jzcvkd53lpf6j9w93x806z5x5c0t8q"

# Build if needed
gcc -o "$CLIP" "$ROOT/agents/linux/clipwatch.c" -lX11 -lm -O2 || true
gcc -o "$BRIDGE" "$ROOT/agents/linux/bridge.c" -O2 || true

# start clipwatch in daemon mode
"$CLIP" --daemon >/tmp/ultralock-clip.log 2>&1 &
CLIP_PID=$!
sleep 0.5

# start bridge and capture token/port
TMPOUT=$(mktemp)
"$BRIDGE" > "$TMPOUT" 2>&1 &
BRIDGE_PID=$!
# wait for startup
sleep 0.5
PORT=$(grep -oP "127\\.0\\.0\\.1:\K\\d+" "$TMPOUT" | head -n1)
TOKEN=$(grep -oP "Token: \K[0-9a-f]+" "$TMPOUT" | head -n1)
if [ -z "$PORT" ] || [ -z "$TOKEN" ]; then echo "Bridge failed to start"; cat "$TMPOUT"; kill $CLIP_PID $BRIDGE_PID || true; exit 2; fi

# call bindaddr
curl -s "http://127.0.0.1:$PORT/bindaddr?address=$TEST_ADDR&token=$TOKEN" > /tmp/bridge_res.txt
if ! grep -q "OK" /tmp/bridge_res.txt; then echo "bind failed"; cat /tmp/bridge_res.txt; kill $BRIDGE_PID $CLIP_PID || true; exit 2; fi

# verify LIST shows an FP (retry a few times to avoid races)
FOUND=0
for i in {1..40}; do
    LIST_OUT=$("$IPC" LIST 2>/dev/null || true)
    if echo "$LIST_OUT" | grep -q "FP "; then FOUND=1; break; fi
    sleep 0.05
done
if [ "$FOUND" -ne 1 ]; then echo "LIST did not show FP after bind"; kill $BRIDGE_PID $CLIP_PID || true; exit 2; fi

# now restart the clipwatch agent to test persistence
kill $CLIP_PID || true
sleep 0.2
# start clipwatch again
"$CLIP" --daemon >/tmp/ultralock-clip.log 2>&1 &
CLIP_PID2=$!
sleep 0.5

# verify LIST still shows FP after restart
FOUND2=0
for i in {1..40}; do
    LIST_OUT=$("$IPC" LIST 2>/dev/null || true)
    if echo "$LIST_OUT" | grep -q "FP "; then FOUND2=1; break; fi
    sleep 0.05
done
trap 'kill $BRIDGE_PID $CLIP_PID $CLIP_PID2 || true; rm -f "$TMPOUT"; exit' EXIT
if [ "$FOUND2" -eq 1 ]; then
    echo "address is safe and passed"
    # cleanup
    kill $BRIDGE_PID $CLIP_PID $CLIP_PID2 || true
    rm -f "$TMPOUT"
    exit 0
else
    echo "LIST did not show FP after restart"; kill $BRIDGE_PID $CLIP_PID $CLIP_PID2 || true; exit 2
fi
