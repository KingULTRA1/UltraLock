(function () {
  'use strict';

  // Dogecoin uses Base58Check; common prefix 'D' (P2PKH)
  function isValidBase58(addr) {
    if (!addr || typeof addr !== 'string') return false;
    if (!/^[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(addr)) return false;
    // Prefer lightweight check: prefix + base58check validity via BTC helper if present
    if (window.UltraLockBTC && window.UltraLockBTC.isValidBase58) {
      return window.UltraLockBTC.isValidBase58(addr).then((ok) => ok && /^[DA]/.test(addr));
    }
    // Otherwise reject (fail-closed)
    return Promise.resolve(false);
  }

  window.UltraLockDOGE = { isValidBase58 };
})();