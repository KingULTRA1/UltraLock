(function () {
  'use strict';

  async function isValidAddress(addr) {
    if (!addr || typeof addr !== 'string') return false;
    const m = addr.match(/^0x([0-9a-fA-F]{40})$/);
    if (!m) return false;
    const hex = m[1];
    // If mixed-case, require EIP-55 checksum to be valid
    const hasLower = /[a-f]/.test(hex);
    const hasUpper = /[A-F]/.test(hex);
    if (hasLower && hasUpper) {
      try {
        const checksummed = await window.UltraLockCanonicalize.canonicalize(addr, 'eth');
        return checksummed === addr;
      } catch (err) {
        return false; // cannot compute checksum -> fail-closed
      }
    }
    // all lower or all upper are accepted (will be canonicalized to checksum later)
    return true;
  }

  window.UltraLockEVM = { isValidAddress };
})();