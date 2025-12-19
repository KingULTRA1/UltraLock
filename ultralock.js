/* ultralock.js — Single-file, dependency-free address copy/paste integrity protector
   Goals: zero-deps, pure browser JS, simple UI, fail-closed integrity checks.

   Usage: include <script src="ultralock.js"></script> on a page or inject it as a bookmarklet.
   The script auto-inits when loaded. For manual init: call window.UltraLock.init(options).

   Key behaviors (enforced locally, deterministic):
   - Detect addresses on copy and paste (chain-aware heuristics + generic fallback)
   - Fingerprint addresses via Web Crypto (SHA-256 hex -> first 16 chars)
   - On COPY: canonicalize->fingerprint, write in-memory metadata, try to write dual clipboard if allowed
   - On COPY: if clipboard metadata exists and mismatches selection -> block copy & show immediate critical alert
   - On PASTE: recompute fingerprint and compare to last verified metadata; if missing or mismatch -> block paste and show blocking alert
   - Post-paste: attach MutationObserver to detect later changes and disable the field if mutated

   Notes:
   - This file uses only native Web APIs (Clipboard, Crypto.subtle, DOM). No network, no npm.
   - Designed to be auditable and minimal.
*/
(function () {
  'use strict';

  // Configuration
  const FINGERPRINT_LEN = 16; // hex chars
  const METADATA_TTL_MS = 60 * 1000; // keep metadata valid for 60s

  // ---------- Minimal UI helpers (no CSS files) ----------
  function ensureRoot() {
    let r = document.getElementById('UltraLock-root');
    if (r) return r;
    r = document.createElement('div');
    r.id = 'UltraLock-root';
    Object.assign(r.style, {
      position: 'fixed',
      zIndex: 2147483647,
      right: '12px',
      top: '12px',
      fontFamily: 'sans-serif',
      pointerEvents: 'none'
    });
    document.documentElement.appendChild(r);
    return r;
  }

  function showLock(text) {
    const root = ensureRoot();
    clearLocks();
    const el = document.createElement('div');
    el.className = 'UltraLock-lock';
    el.textContent = `🔒 ${text}`;
    Object.assign(el.style, {
      background: '#0b5',
      color: '#001',
      padding: '6px 10px',
      borderRadius: '6px',
      marginBottom: '6px',
      pointerEvents: 'auto'
    });
    root.appendChild(el);
    // Keep visible a long time to follow requirement that lock remains visible
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 5 * 60 * 1000);
  }

  function showBlockingAlert(msg) {
    const root = ensureRoot();
    // remove previous alerts
    Array.from(root.querySelectorAll('.UltraLock-alert')).forEach((n) => n.remove());
    const el = document.createElement('div');
    el.className = 'UltraLock-alert';
    Object.assign(el.style, {
      background: '#d33',
      color: '#fff',
      padding: '12px',
      borderRadius: '6px',
      marginTop: '6px',
      maxWidth: '420px',
      pointerEvents: 'auto'
    });
    const p = document.createElement('div');
    p.textContent = msg;
    el.appendChild(p);
    const btn = document.createElement('button');
    btn.textContent = 'Abort';
    Object.assign(btn.style, { marginTop: '8px', padding: '6px 10px', cursor: 'pointer' });
    btn.addEventListener('click', () => el.remove());
    el.appendChild(btn);
    root.appendChild(el);
  }

  function clearLocks() {
    const root = document.getElementById('UltraLock-root');
    if (!root) return;
    Array.from(root.children).forEach((c) => {
      if (c.className && c.className.indexOf('UltraLock-') === 0) return; // keep
    });
  }

  // ---------- Address detection heuristics ----------
  // Each entry: { chain, regex } — simple, conservative patterns
  const patterns = [
    { chain: 'eth', regex: /0x[a-fA-F0-9]{40}/g },
    { chain: 'btc_bech32', regex: /\b(?:bc1)[0-9a-z]{25,39}\b/gi },
    { chain: 'btc_base58', regex: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g },
    { chain: 'ltc_bech32', regex: /\b(?:ltc1)[0-9a-z]{25,39}\b/gi },
    { chain: 'doge', regex: /\bD[a-km-zA-HJ-NP-Z1-9]{24,33}\b/g },
    { chain: 'sol', regex: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g },
    { chain: 'trx', regex: /\bT[a-zA-Z0-9]{33}\b/g },
    { chain: 'xrp', regex: /\b[rR][a-zA-Z0-9]{24,34}\b/g },
    // Generic fallback: long alphanumeric strings that look like addresses
    { chain: 'unknown', regex: /\b[a-zA-Z0-9]{26,128}\b/g }
  ];

  function detectAddress(text) {
    if (!text || typeof text !== 'string') return null;
    // Try each pattern in order; stop at first credible match
    for (const p of patterns) {
      const m = text.match(p.regex);
      if (m && m.length) {
        // choose the longest candidate in matches (heuristic)
        const cand = m.reduce((a, b) => (a.length >= b.length ? a : b));
        return { chain: p.chain, address: cand.trim() };
      }
    }
    return null;
  }

  // ---------- Canonicalization + fingerprint ----------
  function canonicalize(addr, chain) {
    let a = String(addr).trim();
    // EVM: keep lowercase for fingerprinting (we do not try EIP-55 canonicalization here to stay minimal)
    if (chain === 'eth') a = a.toLowerCase();
    // Bech32: lowercase canonical (BIP-173)
    if (chain && chain.indexOf('bech32') !== -1) a = a.toLowerCase();
    return a;
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(String(text));
    const hash = await (crypto && crypto.subtle ? crypto.subtle.digest('SHA-256', data) : Promise.reject(new Error('no-subtle')));
    const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex;
  }

  async function fingerprintFor(addr, chain) {
    const c = canonicalize(addr, chain);
    const h = await sha256Hex(c);
    return h.slice(0, FINGERPRINT_LEN);
  }

  // ---------- Memory store for clipboard metadata (single-tab memory-only fallback) ----------
  // Stored shape: { address, chain, fingerprint, ts }
  const memory = { last: null };

  function writeMemoryMeta(meta) {
    memory.last = Object.assign({}, meta, { ts: Date.now() });
  }

  function readMemoryMeta() {
    const m = memory.last;
    if (!m) return null;
    if (Date.now() - (m.ts || 0) > METADATA_TTL_MS) return null;
    return m;
  }

  async function tryReadClipboardMeta() {
    // Best-effort: attempt to read 'application/x-ultralock+json' via Clipboard API
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          if (it.types && it.types.includes('application/x-ultralock+json')) {
            const blob = await it.getType('application/x-ultralock+json');
            const txt = await blob.text();
            try {
              return JSON.parse(txt);
            } catch (e) { return null; }
          }
        }
      }
    } catch (e) {
      // Not fatal — we fall back to in-memory metadata
    }
    return readMemoryMeta();
  }

  async function tryWriteDualClipboard(text, meta) {
    // Try to write both plain text and app-specific json mime
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blobText = new Blob([text], { type: 'text/plain' });
        const blobMeta = new Blob([JSON.stringify(meta)], { type: 'application/x-ultralock+json' });
        const item = new ClipboardItem({ 'text/plain': blobText, 'application/x-ultralock+json': blobMeta });
        await navigator.clipboard.write([item]);
        return true;
      }
    } catch (e) {
      // ignore and continue
    }
    // Fallback: cannot write custom mime, rely on in-memory store
    writeMemoryMeta(meta);
    return false;
  }

  // ---------- Event handlers ----------
  async function onCopy(e) {
    try {
      // determine selected text from window selection or focused input
      let sel = window.getSelection() && window.getSelection().toString();
      if (!sel) {
        const a = document.activeElement;
        if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) {
          const s = a.selectionStart || 0;
          const t = a.selectionEnd || a.value.length;
          sel = a.value.substring(s, t);
        } else if (a && a.isContentEditable) {
          sel = (window.getSelection() && window.getSelection().toString()) || '';
        }
      }
      if (!sel) return; // nothing selected

      const detected = detectAddress(sel);
      if (!detected) return; // not an address-like selection — do nothing

      const canonical = canonicalize(detected.address, detected.chain);
      const fp = await fingerprintFor(canonical, detected.chain);
      console.debug('[UltraLock] onCopy detected', { chain: detected.chain, address: canonical, fingerprint: fp });

  (truncated...)