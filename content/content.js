/* UltraLock content script
   Responsibilities:
   - Intercept copy events and generate dual clipboard payloads
   - Intercept paste events, validate fingerprint/metadata, and block on mismatch
   - Attach MutationObserver to post-paste monitoring
   - Show overlay indicator via overlay.js
*/



// Use immediate closure to avoid polluting page scope
(function () {
  'use strict';

  // Utilities
  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Lightweight imports (bundled as files under validators/ and utils/ in extension)
  function loadScript(path) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(path);
    s.defer = true;
    document.documentElement.appendChild(s);
  }

  loadScript('utils/canonicalize.js');
  loadScript('utils/fingerprint.js');
  loadScript('utils/clipboard.js');
  // validators
  loadScript('validators/evm.js');
  loadScript('validators/btc.js');
  loadScript('validators/ltc.js');
  loadScript('validators/doge.js');
  loadScript('validators/sol.js');
  // detection and overlay
  loadScript('utils/detect.js');
  loadScript('content/overlay.js');

  // Memory-only store for metadata with expiry
  const metadataStore = new WeakMap(); // element -> {fingerprint, expiresAt}

  const METADATA_TTL_MS = 60 * 1000; // 60s

  // Copy handler
  async function onCopy(e) {
    try {
      const selection = window.getSelection().toString();
      if (!selection) return;
      const detected = await window.UltraLockDetect.detectAddress(selection);
      if (!detected) return; // nothing to do

      const canonical = await window.UltraLockCanonicalize.canonicalize(detected.address, detected.chain);
      const hex = await sha256Hex(canonical);
      const fingerprint = hex.slice(0, 16);

      // Check existing clipboard metadata to detect pre-copy hijack
      const existingMeta = await window.UltraLockClipboard.readMetadataFromClipboard();
      if (existingMeta) {
        try {
          // If chain/address/fingerprint mismatch, block and show immediate alert
          if (existingMeta.fingerprint && existingMeta.fingerprint !== fingerprint) {
            // Block the copy action — fail-closed
            e.preventDefault();
            e.stopImmediatePropagation();
            window.UltraLockOverlay.showBlocked('⚠️ Attention: The address you copied does not match the original verified address. UltraLock enabled. This transaction is NOT secure. Recommendation: Clear your browser or use another device for this transaction.');
            return;
          }
          if (existingMeta.chain && existingMeta.chain !== detected.chain) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.UltraLockOverlay.showBlocked('⚠️ Attention: The address you copied does not match the original verified address. UltraLock enabled. This transaction is NOT secure. Recommendation: Clear your browser or use another device for this transaction.');
            return;
          }
        } catch (err) {
          // If metadata is malformed, fail-closed and block
          e.preventDefault();
          e.stopImmediatePropagation();
          window.UltraLockOverlay.showBlocked('⚠️ Attention: Clipboard metadata is malformed. UltraLock enabled — copy blocked.');
          return;
        }
      }

      const payload = {
        meta_version: 1,
        chain: detected.chain,
        address: canonical,
        fingerprint,
        ts: Date.now()
      };

      // Write dual clipboard payload
      await window.UltraLockClipboard.writeDualClipboard(selection, JSON.stringify(payload));

      // Visual lock
      window.UltraLockOverlay.showLockAtSelection(fingerprint);

    } catch (err) {
      console.error('UltraLock copy handler failed:', err);
      // Fail-closed: If anything goes wrong during the copy instrumentation, block the copy
      try { e.preventDefault(); e.stopImmediatePropagation(); } catch (ignored) {}
      window.UltraLockOverlay.showBlocked('⚠️ UltraLock encountered an error and blocked the copy to preserve integrity.');
    }
  }

  // Paste handler
  async function onPaste(e) {
    // Prevent default paste and apply validated payload only
    try {
      const clipboardText = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (!clipboardText) return; // nothing to do

      // Try to read UltraLock metadata mime type if present
      const rawMeta = (e.clipboardData && e.clipboardData.getData('application/x-ultralock+json')) || null;
      let meta = null;
      if (rawMeta) {
        try { meta = JSON.parse(rawMeta); } catch (err) { meta = null; }
      }

      const detected = await window.UltraLockDetect.detectAddress(clipboardText);
      if (!detected) return; // allow normal paste (no address)

      const canonical = await window.UltraLockCanonicalize.canonicalize(detected.address, detected.chain);
      const hex = await sha256Hex(canonical);
      const fingerprint = hex.slice(0, 16);

      // Validate metadata
      if (!meta || meta.fingerprint !== fingerprint || meta.chain !== detected.chain || (Date.now() - meta.ts) > METADATA_TTL_MS) {
        // Block paste
        e.preventDefault();
        window.UltraLockOverlay.showBlocked('Address integrity check failed — paste blocked.');
        // For keyboard and context menu paste, we prevent default and stop propagation
        e.stopImmediatePropagation();
        return;
      }

      // metadata matches → allow paste but ensure canonical address inserted
      // Insert canonical text into active element
      e.preventDefault();
      const active = document.activeElement;
      if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        insertTextAtActive(canonical);
        // Attach metadata entry for post-paste monitoring
        metadataStore.set(active, { fingerprint, expiresAt: Date.now() + METADATA_TTL_MS });
        // Show locked indicator
        window.UltraLockOverlay.showLocked(fingerprint, active);
      } else {
        // Fallback — insert using execCommand as last resort
        document.execCommand('insertText', false, canonical);
      }

    } catch (err) {
      console.error('UltraLock paste handler failed:', err);
      e.preventDefault();
      e.stopImmediatePropagation();
      window.UltraLockOverlay.showBlocked('Unexpected failure during paste verification.');
    }
  }

  function insertTextAtActive(text) {
    const el = document.activeElement;
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
      sel.collapseToEnd();
    } else if (el.selectionStart !== undefined) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      el.value = value.slice(0, start) + text + value.slice(end);
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Post-paste DOM mutation monitoring
  function observeElement(el) {
    if (!el) return;
    const moz = el.__ultralockObserver;
    if (moz) return; // already observed

    const observer = new MutationObserver((_records) => {
      const meta = metadataStore.get(el);
      if (!meta) return; // nothing to verify
      (async () => {
        const content = extractElementText(el);
        const maybeDetected = await window.UltraLockDetect.detectAddress(content);
        if (!maybeDetected) {
          // Address removed / mutated
          invalidateElement(el, 'Address disappeared or mutated');
          return;
        }
        try {
          const canonical = await window.UltraLockCanonicalize.canonicalize(maybeDetected.address, maybeDetected.chain);
          const hex = await window.UltraLockFingerprint.sha256Hex(canonical);
          const f = hex.slice(0, 16);
          if (f !== meta.fingerprint) {
            invalidateElement(el, 'Address fingerprint no longer matches — blocked');
          }
        } catch (err) {
          invalidateElement(el, 'Post-paste verification failed');
        }
      })();
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    el.__ultralockObserver = observer;
  }

  function invalidateElement(el, reason) {
    // Block further interaction on this element
    try {
      el.disabled = true;
      window.UltraLockOverlay.showBlocked(reason, el);
    } catch (err) {
      console.error('UltraLock invalidation failed:', err);
    }
  }

  function extractElementText(el) {
    if (el.isContentEditable) return el.innerText;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value;
    return el.textContent || '';
  }

  // Event listeners
  document.addEventListener('copy', onCopy, true);
  document.addEventListener('paste', onPaste, true);

  // Observe focus to attach mutation observation when element receives metadata
  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    const meta = metadataStore.get(el);
    if (meta) observeElement(el);
  }, true);

  // Expose a few helpers into window for other scripts
  window.UltraLockMeta = { metadataStore, METADATA_TTL_MS };

})();
