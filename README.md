# UltraLock🔒

**Test:** Copy the BTC address below. Modify it. Paste it. UltraLock will block it.

**Claim:** UltraLock enforces clipboard integrity at the moment of use. If the data changes, the operation is blocked.

- **BTC:** `bc1qw9cqf600jzcvkd53lpf6j9w93x806z5x5c0t8q`
- **Lightning invoice:** `lnbc1p55tcmqdqdgdshx6pqg9c8qpp5kduld8g5a36krmgy3gpejkr4wwcvpql33klwvwq3wqfefzuwcjpssp5g38e2nkfcclnfuazs9cu4kcp80gtxd308ldz4hvvqpx86efrxwvs9qrsgqcqpcxqy8ayqrzjqtsjy9p55gdceevp36fvdmrkxqvzfhy8ak2tgc5zgtjtra9xlaz97r026vqqv8qqquqqqqqqqqqqqqqq9grzjqfzhphca8jlc5zznw52mnqxsnymltjgg3lxe4ul82g42vw0jpkgkwzzl0sqqxgsqqqqqqqqqqqqqqqqq9gwhhm904pkn7zd9ju7lfr2y26fxdcvusck6x3z0tvdf905pe6j3sk25mjanq00lks6r7ve5amsk03kz9fk73yzvpdgjlasysz9r52wqcpdm7a3`


**Release:** v1.01 (Final) — single-file, zero-deps, fail-closed address integrity protector.

UltraLock🔒: A browser script that ensures crypto wallet addresses remain immutable and tamper-proof during copy and paste.

**Core script:** `UltraLock.js` — single-file, zero-deps, fail‑closed address integrity protector.

## Manual test
Open `test.html` in a real browser (or via the local server at `http://127.0.0.1:8000/test.html`). Use the **Automation helpers** section to simulate Copy / Paste flows:

- **Simulate Copy ETH**: triggers the copy handler for the ETH example and writes in-memory metadata.
- **Simulate Paste (good)**: dispatches a paste event using the in-memory metadata — should allow the paste.
- **Simulate Paste (bad)**: dispatches a paste event with a mismatched address — should block and show an alert.
- **Show Memory Meta**: display the in-memory clipboard metadata for debugging.

Note: The browser's native Clipboard API may restrict read/write in certain contexts; use a real browser page (not a file:// URL) and check the console for debug logs.
## Installation & usage 🔧

### Browser (UltraLock.js)

- Quick (local) install: download `ultralock.js` and include it in pages you control or trust:

  ```html
  <script src="/path/to/ultralock.js"></script>
  ```

- Bookmarklet (single-click loading): create a bookmark whose URL is:

  ```text
  javascript:(function(){var s=document.createElement('script');s.src='https://your-host.tld/ultralock.js';document.documentElement.appendChild(s);})();
  ```

  Replace the `src` with a trusted raw URL (e.g., your own host or a GitHub raw link). Bookmarklets load the script into the active page and are useful when you can't edit the page HTML.

- Userscript (Tampermonkey/Greasemonkey): wrap `ultralock.js` as a userscript and configure it to run on the sites where you want protections. This is the recommended way to get persistent behavior without hosting pages yourself.

- Embedding in a wallet or app: for WebView-based wallets or hosted apps, integrate `ultralock.js` into the app's page context or run it as part of the in-app web layer so clipboard interception happens in-process.

### Linux agent (headless clipboard enforcement)

- Build (no third-party deps):

  ```sh
  # requires gcc and libX11 dev headers only
  gcc -o clipwatch agents/linux/clipwatch.c -lX11 -lm -O2
  ```

- Run (normal, requires X11):

  ```sh
  ./clipwatch
  ```

  When running in a desktop session the agent monitors the CLIPBOARD and will replace unbound addresses with a blocking message (fail-closed). The agent accepts fingerprint-only registrations over a local unix socket at `$XDG_RUNTIME_DIR/ultralock.sock` (0600).

- Headless self-test (one-step, no X required): verify the installation and binding flow with the built-in test:

  ```sh
  ./clipwatch --selftest
  # Expected output: address is safe and passed
  ```

  The self-test simulates binding a canonical fingerprint for the example BTC address and verifies that the agent allows it — the single-line output above indicates success.

- IPC helper: A small helper script is included at `agents/linux/ipc_cli.sh` for `LIST`, `BIND <fp>`, and `UNBIND <fp>` using only common system tools (`nc`, `socat`, or Python's AF_UNIX socket).

- Systemd (recommended): install the agent and bridge as user services so they auto-start on login and persist across reboots.

  1. Build the binaries (if not already built):

     ```sh
     gcc -o agents/linux/clipwatch agents/linux/clipwatch.c -lX11 -lm -O2
     gcc -o agents/linux/bridge agents/linux/bridge.c -O2
     ```

  2. Install units and binaries (installs to `~/.local/bin` and `~/.config/systemd/user`):

     ```sh
     ./agents/linux/install_systemd.sh
     ```

  3. Enable and start the services (once systemctl is available):

     ```sh
     systemctl --user daemon-reload
     systemctl --user enable --now ultralock-agent ultralock-bridge
     ```

  4. Verify status:

     ```sh
     systemctl --user status ultralock-agent ultralock-bridge
     ```

  Security notes:
  - Units run as your user and use `ExecStart=%h/.local/bin/...` so the services operate only in your userspace.
  - The bridge writes a short token to `$XDG_RUNTIME_DIR/ultralock_http_token` which the browser helper must present when calling the bridge (see next steps for browser helper guidance).

- Installation tip: install as a user service (systemd user unit) or start it from your session's autostart for continuous protection.

## How to verify (manual quick checklist) ✅

1. Serve the repo and open `test.html` from `http://127.0.0.1:8000/test.html` (or a similar secure origin).
2. Use the **Automation helpers**: click **Simulate Copy ETH**, then **Show Memory Meta** (you should see fingerprint data).  
3. Click **Simulate Paste (good)**: the canonical address should be inserted and a lock UI shown.  
4. Click **Simulate Paste (bad)**: the paste should be blocked and a prominent blocking alert displayed.  
5. After a successful paste, attempt to edit the field (simulate a mutation); the script should disable the element and show an alert if the address no longer matches the original fingerprint.

Check the browser console (F12) to see debug logs when using the automation helpers.

## Browser compatibility & limitations ⚠️

- **Fail‑closed model implemented:** UltraLock blocks on missing or mismatched metadata and on post-paste mutation.
- **Clipboard API differences:** some browsers (or secure contexts) restrict reading/writing custom clipboard MIME types. UltraLock uses a memory fallback to maintain protection in single-tab scenarios. This reduces, but does not fully eliminate, environment-specific differences.
- **Mobile & WebView caveats:** iOS and some mobile WebViews have limited clipboard interception; for high-value transactions prefer a desktop test or use a dedicated 'Paste into UltraLock' flow inside a trusted app where possible.
- **Not a substitute for external verification:** UltraLock protects against in-browser clipboard swaps and post‑paste mutations, but you should still verify high‑value transactions through independent channels when possible.

## Security & privacy notes 🔐

- Zero external network usage — all operations (detection, canonicalization, fingerprinting) run locally in the browser using the Web Crypto API.
- Core script is single-file and dependency-free (`ultralock.js`) to make auditing straightforward.
- Memory-only fallback is ephemeral (short TTL). The script aims to minimize persisted sensitive data.

## Persistence & audit verification (Linux agent) 🔧

- Durable binds store: the Linux agent persists registered bindings to a file at one of these paths (0600):
  - `$XDG_DATA_HOME/ultralock_binds.txt` or `~/.local/share/ultralock_binds.txt` (fall-back).
  - Binds are written atomically (tmp->rename) and are saved on every successful `BIND`, `UNBIND`, and `UNBINDADDR` operation.

- Append-only audit log: the agent maintains an append-only audit log at:
  - `$XDG_RUNTIME_DIR/ultralock_audit.log` or `~/.local/share/ultralock_audit.log` (fall-back). Each entry contains a chained SHA-256 hash to enable tamper detection.
  - The audit log is fsync'd after each append to provide durability guarantees.

- Audit verification tool (new): a tiny verifier `agents/linux/audit_verify.c` checks the integrity of the audit log by verifying the chained SHA-256 values. Usage:

  ```sh
  # Build the verifier
  gcc -o agents/linux/audit_verify agents/linux/audit_verify.c -O2

  # Run verification (exits 0 on success, non-zero on failure)
  ./agents/linux/audit_verify
  ```

- Integration tests included:
  - `agents/linux/test_persistence.sh` — tests that binds survive an agent restart (bind → restart → LIST shows the FP).
  - `agents/linux/test_audit_verify.sh` — checks the verifier succeeds on an intact log and fails when the log is tampered.

## Core frozen (2025-12-20) ❄️

- **Final freeze:** As of v1.01+ (2025-12-20), the UltraLock *core* components — browser script (`ultralock.js`), Linux agent (`clipwatch`), local bridge, signed helper, bind store, and audit verification tooling — are considered functionally complete and **frozen**. Only critical security fixes, audit-verification improvements, or portability bug fixes will be accepted to these core parts. No further feature additions will be made to the core.

## Project files

- `ultralock.js` — single-file core implementation (zero-deps).
- `test.html` — manual test harness with automation helpers.
- `CONTRIBUTING.md`, `SECURITY.md` — project governance & security notes.

---

Installation helpers (userscript header & bookmarklet) are available in `scripts/install.md`.

---

## Support & Contact

If you find **UltraLock🔒** useful, consider supporting development or sending a message: [@Ultra1 on X](https://x.com/Ultra1)

**Donations:**  
- **BTC:** `bc1qw9cqf600jzcvkd53lpf6j9w93x806z5x5c0t8q`  
- **Lightning:** `lnbc1p55tcmqdqdgdshx6pqg9c8qpp5kduld8g5a36krmgy3gpejkr4wwcvpql33klwvwq3wqfefzuwcjpssp5g38e2nkfcclnfuazs9cu4kcp80gtxd308ldz4hvvqpx86efrxwvs9qrsgqcqpcxqy8ayqrzjqtsjy9p55gdceevp36fvdmrkxqvzfhy8ak2tgc5zgtjtra9xlaz97r026vqqv8qqquqqqqqqqqqqqqqq9grzjqfzhphca8jlc5zznw52mnqxsnymltjgg3lxe4ul82g42vw0jpkgkwzzl0sqqxgsqqqqqqqqqqqqqqqqq9gwhhm904pkn7zd9ju7lfr2y26fxdcvusck6x3z0tvdf905pe6j3sk25mjanq00lks6r7ve5amsk03kz9fk73yzvpdgjlasysz9r52wqcpdm7a3r`

---

**⚠️ Final reminder:**  
**Be safe. Stay protected. Stay ethical.**
