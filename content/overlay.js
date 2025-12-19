/* Minimal overlay manager for UltraLock visual indicators */
(function () {
  'use strict';

  function ensureRoot() {
    if (document.getElementById('ultralock-root')) return document.getElementById('ultralock-root');
    const root = document.createElement('div');
    root.id = 'ultralock-root';
    root.style.position = 'fixed';
    root.style.zIndex = 2147483647; // very top
    root.style.pointerEvents = 'none';
    document.documentElement.appendChild(root);
    return root;
  }

  function showLockAtSelection(fingerprint) {
    const root = ensureRoot();
    const el = document.createElement('div');
    el.className = 'ultralock-indicator locked';
    el.textContent = `🔒 ${fingerprint}`;
    Object.assign(el.style, {
      position: 'fixed',
      right: '12px',
      top: '12px',
      background: '#0b5',
      color: '#001',
      padding: '6px 8px',
      borderRadius: '6px',
      pointerEvents: 'auto',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
    });
    root.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function showBlocked(message, opts) {
    // opts.blocking = true will create a full-screen modal that blocks interaction
    const blocking = opts && opts.blocking;
    const root = ensureRoot();
    const el = document.createElement('div');
    el.className = 'ultralock-indicator blocked';
    // Build modal content
    const content = document.createElement('div');
    content.style.whiteSpace = 'pre-wrap';
    content.textContent = message; // message should include icon prefix to preserve exact alert wording

    el.appendChild(content);

    if (blocking) {
      const btn = document.createElement('button');
      btn.textContent = 'Abort';
      Object.assign(btn.style, {
        marginTop: '8px',
        padding: '8px 10px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer'
      });
      btn.addEventListener('click', () => el.remove());
      el.appendChild(btn);
    }

    Object.assign(el.style, {
      position: blocking ? 'fixed' : 'fixed',
      left: blocking ? '0' : '12px',
      top: blocking ? '0' : '12px',
      right: blocking ? '0' : '',
      bottom: blocking ? '0' : '',
      background: '#d33',
      color: '#fff',
      padding: blocking ? '24px' : '8px 10px',
      borderRadius: blocking ? '0' : '6px',
      pointerEvents: 'auto',
      boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
      maxWidth: blocking ? '100%' : '420px',
      zIndex: 2147483647,
      display: 'flex',
      flexDirection: 'column'
    });

    root.appendChild(el);

    // Keep a critical/attention alert longer so user sees it; blocking needs user action
    if (!blocking) setTimeout(() => el.remove(), 15000);
  }

  function showLocked(fingerprint, el) {
    // Pin a small lock next to the element
    const rect = el.getBoundingClientRect();
    const badge = document.createElement('div');
    badge.className = 'ultralock-badge';
    badge.textContent = `🔒 ${fingerprint}`;
    Object.assign(badge.style, {
      position: 'absolute',
      left: `${rect.right + window.scrollX + 4}px`,
      top: `${rect.top + window.scrollY}px`,
      background: '#0b5',
      color: '#001',
      padding: '4px 6px',
      borderRadius: '4px',
      zIndex: 2147483647,
      pointerEvents: 'none',
      boxShadow: '0 1px 6px rgba(0,0,0,0.4)'
    });
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 30000);
  }

  window.UltraLockOverlay = {
    showLockAtSelection,
    showBlocked,
    showLocked
  };
})();
