(function () {
  'use strict';

  async function isValidAddress(addr) {
    if (window.UltraLockEVM && window.UltraLockEVM.isValidAddress) return window.UltraLockEVM.isValidAddress(addr);
    return false;
  }

  window.UltraLockETH = { isValidAddress };
})();