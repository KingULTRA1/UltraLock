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
