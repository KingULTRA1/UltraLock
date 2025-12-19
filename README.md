# UltraLock🔒

**Release:** v1.01 (Final) — single-file, zero-deps, fail-closed address integrity protector.

UltraLock🔒: A browser script that ensures crypto wallet addresses remain immutable and tamper-proof during copy and paste.

**Core script:** `ultralock.js` — single-file, zero-deps, fail‑closed address integrity protector.

## Manual test
Open `test.html` in a real browser (or via the local server at `http://127.0.0.1:8000/test.html`). Use the **Automation helpers** section to simulate Copy / Paste flows:

- **Simulate Copy ETH**: triggers the copy handler for the ETH example and writes in-memory metadata.
- **Simulate Paste (good)**: dispatches a paste event using the in-memory metadata — should allow the paste.
- **Simulate Paste (bad)**: dispatches a paste event with a mismatched address — should block and show an alert.
- **Show Memory Meta**: display the in-memory clipboard metadata for debugging.

Note: The browser's native Clipboard API may restrict read/write in certain contexts; use a real browser page (not a file:// URL) and check the console for debug logs.
## Installation & usage 🔧

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

## Project files

- `ultralock.js` — single-file core implementation (zero-deps).
- `test.html` — manual test harness with automation helpers.
- `CONTRIBUTING.md`, `SECURITY.md` — project governance & security notes.

---

If you want, I can add a ready-to-use userscript header (Tampermonkey) and a bookmarklet generator snippet to the repo to make installation easier across devices.