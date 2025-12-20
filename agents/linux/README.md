Linux agent prototype — UltraLock clipboard protector

Overview
- This folder contains a minimal, single-file, buildless C prototype `clipwatch.c` to monitor X11 clipboard changes and enforce UltraLock bindings.
- The prototype is intentionally simple, audit-friendly, and does not depend on third-party libraries beyond libc and Xlib.

Build & Run (local user)
1. Install system X11 development headers (if needed):
   - Debian/Ubuntu: `sudo apt-get install libx11-dev`
2. Build: `gcc -o clipwatch clipwatch.c -lX11 -lm`
3. Run: `./clipwatch`

Behavior
- The agent polls the X11 CLIPBOARD selection and detects changes.
- When it sees clipboard content, it canonicalizes and computes a SHA-256 fingerprint (same canonical rules as `UltraLock.js`).
- If the clipboard content does not match a bound fingerprint (a simple memory-based approach), it can replace the clipboard with a clear blocking message.

Security notes
- Device salt is stored locally in `$XDG_DATA_HOME/ultralock/device_salt` by default with restricted permissions (the install script enforces mode 600).
- The agent intentionally avoids any networking or telemetry.
- This is a prototype: for production, ensure proper packaging, process supervision, and code signing.

Installer
- `install.sh` is a minimal installer that builds the binary, installs it to `/usr/local/bin`, and sets up a systemd user service for autostart (optional).

Limitations
- X11-only prototype (Wayland requires different APIs).
- The prototype is synchronous/polling-based for simplicity.
- Requires permissions to access X display. For Wayland, additional code is required.
