require('jsdom-global')();
const fs = require('fs');
global.chrome = { runtime: { getURL: (p) => p } };
// load files
['utils/fingerprint.js','utils/clipboard.js','validators/evm.js','validators/btc.js','validators/sol.js','validators/doge.js','validators/ltc.js','utils/canonicalize.js','utils/detect.js','content/overlay.js','content/content.js'].forEach((f)=>eval(fs.readFileSync(f,'utf8')));

const el = document.createElement('input');
document.body.appendChild(el);
el.value = '0xde709f2102306220921060314715629080e2fb77';
el.focus();
el.setSelectionRange(0, el.value.length);

let blockedMessage = null;
// add mismatched in-memory clipboard metadata to simulate attack
window.__UltraLockLastMetadata = { text: '0xDEADBEEF...', jsonPayload: JSON.stringify({ fingerprint: 'deadbeefcafef00d', chain: 'eth', address: '0xDEADBEEF' }), ts: Date.now() };
const orig = window.UltraLockOverlay.showBlocked;
window.UltraLockOverlay.showBlocked = (m, opts) => { blockedMessage = m; console.log('overlay.showBlocked called with:', m, opts); };

const ev = new Event('copy', { bubbles: true, cancelable: true });
document.dispatchEvent(ev);
console.log('blockedMessage after dispatch:', blockedMessage);
