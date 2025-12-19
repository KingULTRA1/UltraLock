(function () {
  'use strict';

  async function readMetadataFromClipboard() {
    // Attempt to read application/x-ultralock+json from Clipboard API
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types && item.types.includes('application/x-ultralock+json')) {
            const blob = await item.getType('application/x-ultralock+json');
            const text = await blob.text();
            try { return JSON.parse(text); } catch (e) { return null; }
          }
        }
      }
    } catch (err) {
      // ignore and fallback
    }

    // Fallback to in-page transient metadata
    try {
      if (window.__UltraLockLastMetadata && window.__UltraLockLastMetadata.jsonPayload) {
        return JSON.parse(window.__UltraLockLastMetadata.jsonPayload);
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  async function writeDualClipboard(text, jsonPayload) {
    // Attempt modern Clipboard API
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const items = [
          new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) }),
          new ClipboardItem({ 'application/x-ultralock+json': new Blob([jsonPayload], { type: 'application/x-ultralock+json' }) })
        ];
        await navigator.clipboard.write(items);
        return;
      }
    } catch (err) {
      // continue to fallback
      console.warn('navigator.clipboard.write failed, falling back to on-page copy', err);
    }

    // Fallback: create hidden textarea, add metadata to dataTransfer if possible
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    } finally {
      document.body.removeChild(ta);
    }

    // Best-effort: store transient metadata in window (memory-only) mapped to text
    window.__UltraLockLastMetadata = { text, jsonPayload, ts: Date.now() };
  }

  window.UltraLockClipboard = { writeDualClipboard, readMetadataFromClipboard };
})();