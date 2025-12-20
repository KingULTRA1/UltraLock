Smoke test — Linux clipwatch prototype

Prerequisites
- X11 session (not Wayland-only)
- gcc and libx11 development headers
- Optional: xclip or xsel for manual clipboard reads/writes (not required for agent to function)

Steps
1. Build the agent:
   gcc -o clipwatch clipwatch.c -lX11 -lm -O2

2. Run the agent in a terminal (keep it running):
   ./clipwatch

3. In another terminal, copy a BTC address into the clipboard (using your desktop tool or xclip):
   echo -n "bc1qw9cqf600jzcvkd53lpf6j9w93x806z5x5c0t8q" | xclip -selection clipboard -i

4. The agent should detect the address and (in this prototype) replace the clipboard with a blocking message. Check the agent terminal for a message like:
   [ALERT] Replaced clipboard content due to unbound protected address. Canonical: bc1qw9cqf600...

5. Attempt to paste in any application. The pasted content should be the alert message (agent-overwritten clipboard).

Notes
- The prototype treats any detected address as unbound and fails-closed by replacing the clipboard with an alert. Once IPC binding is implemented, the agent will accept bound fingerprints from the browser layer and allow verified clipboard content.
- Wayland support is not implemented in this prototype.

IPC test (BIND/UNBIND/LIST)

1. Ensure the agent is running (in terminal A):
   ./clipwatch

2. In terminal B, use the provided helper to talk to the unix socket:
   ./ipc_cli.sh LIST
   # Expected: "END" (or a list of FP entries if any are bound)

3. Bind a fingerprint (example):
   ./ipc_cli.sh "BIND deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
   # Expected: "OK" or an error if invalid

4. Verify the binding:
   ./ipc_cli.sh LIST
   # Expected: shows FP entry and END

5. Unbind:
   ./ipc_cli.sh "UNBIND deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
   # Expected: "OK"

Note: You will need to generate the correct fingerprint from the browser layer (UltraLock.js) in a real bind flow; these commands demonstrate the IPC protocol and the expected responses.

Headless self-test

- There's a built-in self-test that runs without X or third-party tools. Execute:

  ```sh
  ./clipwatch --selftest
  # Expected output: address is safe and passed
  ```

This performs an internal bind for the example BTC address and verifies that the agent's fingerprint check allows it. The one-line success output indicates the integration test passed.
