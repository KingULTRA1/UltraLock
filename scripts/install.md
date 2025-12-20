UltraLock — Installation helpers

This file includes a Tampermonkey userscript header and a bookmarklet generator you can copy.

Tampermonkey userscript header (paste at top of `ultralock.js` or wrap it):

```js
// ==UserScript==
// @name        UltraLock
// @namespace   https://github.com/KingULTRA1/UltraLock
// @version     1.01
// @description Enforce clipboard integrity for addresses and payment strings
// @author      UltraLock
// @match       *://*/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==
(function() { /* include ultralock.js content here */ })();
```

Bookmarklet (single-line) — replace `https://your-host.tld/ultralock.js` with your hosted raw file if necessary:

```text
javascript:(function(){var s=document.createElement('script');s.src='https://your-host.tld/ultralock.js';document.documentElement.appendChild(s);})();
```

Notes:
- Use a secure origin (https) for full Clipboard API support in modern browsers.
- Tampermonkey is the recommended persistent install for browsers where you cannot modify page HTML.
- The userscript is self-contained and must be audited when used in high-value environments.
