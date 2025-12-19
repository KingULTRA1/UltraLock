(function () {
  'use strict';

  // EVM: canonical form is EIP-55 checksumed address
  async function toChecksumAddress(address) {
    const clean = address.replace(/^0x/, '');
    const addrLower = clean.toLowerCase();
    // Compute keccak256 of lowercase address
    const hashBuffer = await tryKeccak(addrLower);
    if (!hashBuffer) throw new Error('SHA-3 not available to compute checksum');
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    let ret = '0x';
    for (let i = 0; i < addrLower.length; i++) {
      if (parseInt(hashHex[i], 16) >= 8) {
        ret += addrLower[i].toUpperCase();
      } else {
        ret += addrLower[i];
      }
    }
    return ret;
  }

  async function tryKeccak(hexString) {
    try {
      // Try standard SHA-3 name(s)
      const enc = new TextEncoder();
      const data = enc.encode(hexString);
      let hash;
      const names = ['SHA-3-256', 'SHA3-256', 'SHA3_256'];
      for (const name of names) {
        try {
          hash = await crypto.subtle.digest(name, data);
          if (hash) return hash;
        } catch (e) {
          // continue
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function canonicalizeGeneric(address) {
    return address.trim();
  }

  async function canonicalize(address, chain) {
    switch ((chain || '').toLowerCase()) {
      case 'eth':
      case 'evm':
      case 'wbtc':
      case 'weth': {
        // ensure 0x prefix and EIP-55 checksum
        const cleaned = address.replace(/^0x/, '');
        if (!/^[0-9a-fA-F]{40}$/.test(cleaned)) throw new Error('Invalid EVM address');
        return await toChecksumAddress(cleaned);
      }
      case 'btc':
      case 'ltc':
      case 'doge':
        // Base58/bech32 addresses – canonical is exact string (strip whitespace)
        return canonicalizeGeneric(address);
      case 'sol':
        return canonicalizeGeneric(address);
      default:
        throw new Error('Unknown chain for canonicalization');
    }
  }

  window.UltraLockCanonicalize = { canonicalize };
})();