(function () {
  'use strict';

  function isValidBase58(addr) {
    if (!addr || typeof addr !== 'string') return false;
    if (!/^[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(addr)) return false;
    if (window.UltraLockBTC && window.UltraLockBTC.isValidBase58) {
      // Litecoin shares Base58Check algorithm; validate and check prefixes
      return window.UltraLockBTC.isValidBase58(addr).then((ok) => ok && /^[LM3]/.test(addr));
    }
    return Promise.resolve(false);
  }

  function isBech32(addr) {
    // bech32 for ltc should start with ltc1
    try { return addr.toLowerCase().startsWith('ltc1') && window.UltraLockBTC && window.UltraLockBTC.isBech32 ? window.UltraLockBTC.isBech32(addr) : false; } catch (e) { return false; }
  }

  window.UltraLockLTC = { isValidBase58, isBech32 };
})();