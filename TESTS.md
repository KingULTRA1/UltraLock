Manual & automated test checklist — UltraLock v1.01

Manual quick checklist (verifiable):
1. Serve the repo (e.g., python -m http.server 8000) and open `http://127.0.0.1:8000/test.html` in a real browser (https preferred).
2. In the page, click **Simulate Copy BTC (real)**. You should see a small UltraLock confirmation UI.
3. Click **Simulate Paste (good)**: the canonical BTC address should be inserted and a lock shown.
4. Click **Simulate Paste (bad)**: the paste should be blocked and a prominent alert displayed.
5. Copy the BTC address, then edit it (e.g., change a character) and attempt to paste — UltraLock must block and show an alert.
6. Attempt to paste an address that contains invisible characters (e.g., copy-add `\u200B`) — paste should be blocked.

Threat coverage tests:
- Clipboard swap: while an address is bound, replace system clipboard from another app and attempt to paste — UltraLock shows a blocking alert.
- Race/timing: rapidly copy other content after binding and attempt paste — UltraLock should detect mismatch.
- Extension substitution: install a clipboard-altering extension and attempt to change a bound address — verification blocks paste.

Automated tests (future):
- Unit tests for canonicalization, fingerprint generation, and detection.
- Integration tests that simulate copy/paste events and verify blocking behavior.

Notes:
- Some browsers restrict clipboard read/write permissions on insecure origins; use http(s) and check console logs for failures.
- The OS agent prototypes need manual testing on each platform and additional permissions to access system clipboard.
