/* UltraLock.js — Single-file, buildless, zero-deps browser enforcement
   UltraLock v1.01 (FINAL)

   Strict constraints followed:
   - Single-file, no persistence beyond session memory
   - No external calls, no telemetry, no third-party libs
   - Attach under ONE global: window.UltraLock
   - Fail-closed enforcement for copy/paste integrity

   Core pipeline: Copy -> Bind -> Monitor -> Verify -> Paste

   Inline documentation explains the security rationale for each function.
*/
(function () {
  'use strict';

  const VERSION = 'v1.01';
  const META_TTL_MS = 2 * 60 * 1000; // ephemeral memory TTL
  const POLL_MS = 750; // conservative polling
  const META_MIME = 'application/x-ultralock+json';

  // ---------- Utilities ----------
  function log() { try { console.debug('[UltraLock]', ...arguments); } catch (e) {} }
  function err() { try { console.error('[UltraLock]', ...arguments); } catch (e) {} }
  function now() { return Date.now(); }

  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(String(text));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function randHex(len) {
    const b = new Uint8Array(len);
    crypto.getRandomValues(b);
    return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  // Detect invisible/unicode trickery
  const INVISIBLE_RE = /[\u200B-\u200F\uFEFF\u2060-\u206F\u202A-\u202E]/;

  // ---------- Session-only salts (no persistence) ----------
  // Per requirement: no persistence beyond session memory. Device salt is session-only.
  const DEVICE_SALT = randHex(16);
  const SESSION_NONCE = randHex(8);

  function executionContext() {
    try { return `${location.origin}|${navigator.userAgent}|${document.title}`; } catch (e) { return 'unknown'; }
  }

  async function computeFingerprint(payload) {
    const composite = `${payload}||${executionContext()}||${DEVICE_SALT}||${SESSION_NONCE}`;
    return await sha256Hex(composite);
  }

  // ---------- Conservative address detection & canonicalization ----------
  const patterns = [
    { chain: 'btc_bech32', regex: /\bbc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{25,90}\b/gi },
    { chain: 'btc_base58', regex: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g },
    { chain: 'eth', regex: /\b0x[a-fA-F0-9]{40}\b/g },
    { chain: 'ln_invoice', regex: /\b(?:lnbc|lntb|lnbcrt)[0-9ac-hj-np-z]+\b/gi },
    { chain: 'generic', regex: /\b[a-zA-Z0-9]{26,128}\b/g }
  ];

  function detectAddress(text) {
    if (typeof text !== 'string') return null;
    for (const p of patterns) {
      const m = text.match(p.regex);
      if (m && m.length) {
        const cand = m.reduce((a,b) => a.length >= b.length ? a : b);
        if (p.chain === 'generic' && cand.length < 32) continue; // avoid false positives
        return { chain: p.chain, address: cand.trim() };
      }
    }
    return null;
  }

  function canonicalize(addr, chain) {
    let a = String(addr).trim();
    if (chain === 'btc_bech32' || chain === 'ln_invoice' || chain === 'generic') a = a.toLowerCase();
    if (chain === 'eth') a = a.toLowerCase();
    a = a.replace(/\s+/g, ''); // remove whitespace
    // Remove invisibles explicitly
    a = a.replace(INVISIBLE_RE, '');
    return a;
  }

  // ---------- In-memory meta store (session-only) ----------
  // meta shape: { fingerprint, canonical, chain, ts }
  let memoryMeta = null;
  function writeMemory(meta) { memoryMeta = Object.assign({}, meta, { ts: now() }); }
  function readMemory() { if (!memoryMeta) return null; if (now() - (memoryMeta.ts || 0) > META_TTL_MS) return null; return memoryMeta; }

  // Try to write both plain text and custom mime type; best-effort
  async function writeClipboard(payload, meta) {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const plain = new Blob([payload], { type: 'text/plain' });
        const mblob = new Blob([JSON.stringify(meta)], { type: META_MIME });
        const item = new ClipboardItem({ 'text/plain': plain, [META_MIME]: mblob });
        await navigator.clipboard.write([item]);
        writeMemory(meta);
        return true;
      }
    } catch (e) { /* fall through */ }
    writeMemory(meta); // fallback memory-only
    return false;
  }

  async function readClipboardMeta() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          if (it.types && it.types.includes(META_MIME)) {
            const b = await it.getType(META_MIME);
            const s = await b.text();
            try { return JSON.parse(s); } catch (e) { return null; }
          }
        }
      }
    } catch (e) { /* not fatal */ }
    return readMemory();
  }

  // ---------- UI (audit-friendly & minimal) ----------
  function ensureRoot() {
    let r = document.getElementById('UltraLock-root');
    if (r) return r;
    r = document.createElement('div'); r.id = 'UltraLock-root';
    Object.assign(r.style, { position: 'fixed', right: '12px', top: '12px', zIndex: 2147483647, fontFamily: 'system-ui,Segoe UI,Roboto,Arial', pointerEvents: 'none' });
    document.documentElement.appendChild(r);
    return r;
  }

  function showBlockingAlert(text) {
    const root = ensureRoot();
    const el = document.createElement('div'); el.className = 'UltraLock-alert';
    Object.assign(el.style, { background: '#c62828', color: '#fff', padding: '10px 12px', borderRadius: '6px', marginTop: '6px', pointerEvents: 'auto', maxWidth: '420px' });
    el.textContent = `UltraLock blocked action: ${text}`;
    const btn = document.createElement('button'); btn.textContent = 'Dismiss'; btn.style.marginLeft = '10px'; btn.addEventListener('click', () => el.remove());
    el.appendChild(btn);
    root.appendChild(el);
  }

  function showInlineLock(canonical, chain) {
    const root = ensureRoot();
    const el = document.createElement('div'); el.className = 'UltraLock-lock';
    el.textContent = `This address is secured by UltraLock🔒 ${chain} ${canonical.slice(0,6)}…${canonical.slice(-6)}`;
    Object.assign(el.style, { background: '#0b5', color: '#001', padding: '8px 10px', borderRadius: '6px', pointerEvents: 'auto' });
    root.appendChild(el);
    setTimeout(() => el.remove(), 7000);
  }

  // ---------- Bind & Verify ----------
  async function bindClipboard(payload, chain) {
    const canonical = canonicalize(payload, chain);
    const fingerprint = await computeFingerprint(canonical);
    const meta = { fingerprint, canonical, chain, ts: now() };
    await writeClipboard(canonical, meta);
    showInlineLock(canonical, chain);
    return meta;
  }

  async function verifyPayload(payload) {
    const detected = detectAddress(payload);
    if (!detected) return { ok: false, reason: 'not-address' };
    const canonical = canonicalize(detected.address, detected.chain);
    const meta = await readClipboardMeta();
    if (!meta) return { ok: false, reason: 'no-meta' };
    const expectedFp = await computeFingerprint(canonical);
    if (expectedFp !== meta.fingerprint) return { ok: false, reason: 'fingerprint-mismatch', meta };
    return { ok: true, meta };
  }

  // ---------- Secure element handling ----------
  function secureElement(el) {
    if (!el) return;
    try {
      el.setAttribute('data-ultralock', 'secured');
      el.readOnly = true;
      el.style.userSelect = 'none';
      let btn = el.nextElementSibling;
      if (!btn || !btn.classList || !btn.classList.contains('ultralock-copy-btn')) {
        btn = document.createElement('button');
        btn.className = 'ultralock-copy-btn';
        btn.textContent = 'Copy (UltraLock)';
        Object.assign(btn.style, { marginLeft: '8px' });
        btn.addEventListener('click', async () => {
          const v = el.value || el.textContent || '';
          const detected = detectAddress(v);
          if (!detected) { showBlockingAlert('No address detected to copy'); return; }
          await bindClipboard(detected.address, detected.chain);
        });
        el.parentNode && el.parentNode.insertBefore(btn, el.nextSibling);
      }
    } catch (e) { err('secureElement failed', e); }
  }

  // ---------- Monitoring (conservative) ----------
  let lastSeenClipboard = null;
  let pollHandle = null;

  async function pollClipboard() {
    try {
      const text = (navigator.clipboard && navigator.clipboard.readText) ? await navigator.clipboard.readText() : null;
      if (text !== lastSeenClipboard) {
        lastSeenClipboard = text;
        if (typeof text === 'string') {
          const d = detectAddress(text);
          const meta = await readClipboardMeta();
          if (d && (!meta || meta.canonical !== canonicalize(d.address, d.chain))) {
            showBlockingAlert('Clipboard mutated or contains unbound address');
          }
        }
      }
    } catch (e) { /* clipboard access may be denied */ }
  }

  function startPolling() { if (!pollHandle) pollHandle = setInterval(pollClipboard, POLL_MS); }
  function stopPolling() { if (pollHandle) { clearInterval(pollHandle); pollHandle = null; } }

  // ---------- Event handlers ----------
  async function handleCopy(evt) {
    try {
      let sel = '';
      if (evt && evt.clipboardData) sel = evt.clipboardData.getData('text/plain') || '';
      if (!sel) sel = (window.getSelection && window.getSelection().toString()) || '';
      if (!sel && document.activeElement) {
        const a = document.activeElement;
        sel = (a.value && a.value.substring(a.selectionStart || 0, a.selectionEnd || a.value.length)) || a.textContent || '';
      }
      const detected = detectAddress(sel);
      if (!detected) return;
      const canonical = canonicalize(detected.address, detected.chain);
      const existing = await readClipboardMeta();
      if (existing && existing.canonical && existing.canonical !== canonical) {
        evt.preventDefault && evt.preventDefault();
        showBlockingAlert('Copy blocked: clipboard metadata mismatch');
        return;
      }
      await bindClipboard(canonical, detected.chain);
    } catch (e) { err('handleCopy error', e); }
  }

  async function handlePaste(evt) {
    try {
      let pasted = '';
      if (evt && evt.clipboardData) pasted = evt.clipboardData.getData('text/plain');
      if (!pasted && navigator.clipboard && navigator.clipboard.readText) pasted = await navigator.clipboard.readText();
      if (!pasted) return;
      if (INVISIBLE_RE.test(pasted)) {
        evt && evt.preventDefault && evt.preventDefault();
        showBlockingAlert('Paste blocked: invisible characters detected');
        return;
      }
      const verified = await verifyPayload(pasted);
      if (!verified.ok) {
        evt && evt.preventDefault && evt.preventDefault();
        showBlockingAlert(`Paste blocked: ${verified.reason}`);
        return;
      }
      // Verified: insert canonical deterministically in focused element
      const target = document.activeElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        evt && evt.preventDefault && evt.preventDefault();
        const meta = verified.meta;
        if (target.isContentEditable) {
          document.execCommand('insertText', false, meta.canonical);
        } else {
          const start = target.selectionStart || 0;
          const end = target.selectionEnd || 0;
          const v = target.value || '';
          const nv = v.slice(0, start) + meta.canonical + v.slice(end);
          target.value = nv;
          const cursor = start + meta.canonical.length;
          try { target.setSelectionRange(cursor, cursor); } catch (e) {}
        }
        showInlineLock(meta.canonical, meta.chain);
      }
    } catch (e) { err('handlePaste error', e); }
  }

  // ---------- Public API and init ----------
  async function init() {
    log('init', VERSION);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('paste', handlePaste, true);
    startPolling();
    setTimeout(() => {
      Array.from(document.querySelectorAll('.ultralock-address, [data-ultralock="address"]')).forEach(el => secureElement(el));
    }, 400);

    // Expose API under single global
    window.UltraLock = Object.assign(window.UltraLock || {}, {
      bindClipboard,
      verifyPayload,
      secureElement,
      readMeta: readClipboardMeta,
      version: VERSION
    });

    // Attach internal helpers under window.UltraLock._internal (single global namespace)
    try {
      Object.defineProperty(window.UltraLock, '_internal', { value: { computeFingerprint, canonicalize, detectAddress }, configurable: true });
    } catch (e) { /* ignore */ }

    log('UltraLock ready');
  }

  try { if (document.readyState === 'complete' || document.readyState === 'interactive') init(); else window.addEventListener('DOMContentLoaded', init); } catch (e) { err('auto-init failed', e); }
})();