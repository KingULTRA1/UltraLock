(function () {
  'use strict';

  const BASE58_CHARS = /^[1-9A-HJ-NP-Za-km-z]+$/;

  function isLikelySolana(addr) {
    if (!addr || typeof addr !== 'string') return false;
    if (!BASE58_CHARS.test(addr)) return false;
    const len = addr.length;
    return len >= 32 && len <= 44; // typical Solana pubkey lengths
  }

  window.UltraLockSOL = { isLikelySolana };
})();