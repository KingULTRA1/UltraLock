Linux agent prototype — design & build notes

Goal
- Provide an example device-native agent that can run headless, monitor system clipboard, and enforce clipboard bindings created by the browser layer.

Constraints
- No third-party libraries or telemetry. Use system libraries only (X11 / Wayland) where available.
- Agent should compute the same fingerprint (canonical payload + execution context + device-salt + session nonce) and be capable of blocking paste events or replacing clipboard contents.

Prototype plan
1. Use X11 selection APIs (Xlib) to read PRIMARY and CLIPBOARD selections and detect changes.
2. Compute canonicalization and fingerprint (exact same algorithm as `ultralock.js`) and compare to stored clipboard metadata. If mismatch or unbound address detected, replace clipboard content with a blocking message and log locally.
3. For robustness, support Wayland-based environments via `wl-clipboard` compatible RPC or an internal Wayland client if available.

Build
- Example: gcc -o clipwatch clipwatch.c -lX11 -lm

Security notes
- Agent must not send network traffic.
- Device salt should be derived and stored securely (e.g., local file with restricted permissions in $XDG_DATA_HOME/ultralock).
- Agents must run with minimal privileges and be auditable.

This repository contains `clipwatch.c` as a design scaffold. It is intentionally minimal and documented so auditors can implement, review, and harden as needed.
