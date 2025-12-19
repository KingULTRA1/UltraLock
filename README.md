# UltraLock🔒
UltraLock🔒: A browser script that ensures crypto wallet addresses remain immutable and tamper-proof during copy and paste.

**Core script:** `ultralock.js` — single-file, zero-deps, fail‑closed address integrity protector.

## Manual test
Open `test.html` in a real browser (or via the local server at `http://127.0.0.1:8000/test.html`). Use the **Automation helpers** section to simulate Copy / Paste flows:

- **Simulate Copy ETH**: triggers the copy handler for the ETH example and writes in-memory metadata.
- **Simulate Paste (good)**: dispatches a paste event using the in-memory metadata — should allow the paste.
- **Simulate Paste (bad)**: dispatches a paste event with a mismatched address — should block and show an alert.
- **Show Memory Meta**: display the in-memory clipboard metadata for debugging.

Note: The browser's native Clipboard API may restrict read/write in certain contexts; use a real browser page (not a file:// URL) and check the console for debug logs.
