(function () {
  'use strict';

  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function fingerprintFor(address) {
    const hex = await sha256Hex(address);
    return hex.slice(0, 16);
  }

  window.UltraLockFingerprint = { sha256Hex, fingerprintFor };
})();