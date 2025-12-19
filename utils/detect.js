(function () {
  'use strict';

  // Import validators from validators/* (loaded by content script insertion)
  async function detectAddress(text) {
    const t = String(text).trim();
    // Quick heuristics + strict validators

    // Ethereum / EVM: 0x + 40 hex chars
    const evmMatch = t.match(/0x[0-9a-fA-F]{40}/);
    if (evmMatch) {
      const candidate = evmMatch[0];
      if (window.UltraLockEVM && await window.UltraLockEVM.isValidAddress(candidate)) return { address: candidate, chain: 'eth' };
    }

    // Bitcoin-like bech32 (bc1...) or base58
    const bech = t.match(/\b(bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+)\b/i);
    if (bech && window.UltraLockBTC && await window.UltraLockBTC.isBech32(bech[1])) return { address: bech[1], chain: 'btc' };

    // Base58 patterns (BTC/LTC/DOGE/SOL)
    const base58 = t.match(/\b([1-9A-HJ-NP-Za-km-z]{25,62})\b/);
    if (base58) {
      const cand = base58[1];
      if (window.UltraLockBTC && await window.UltraLockBTC.isValidBase58(cand)) return { address: cand, chain: 'btc' };
      if (window.UltraLockLTC && await window.UltraLockLTC.isValidBase58(cand)) return { address: cand, chain: 'ltc' };
      if (window.UltraLockDOGE && await window.UltraLockDOGE.isValidBase58(cand)) return { address: cand, chain: 'doge' };
      if (window.UltraLockSOL && window.UltraLockSOL.isLikelySolana(cand)) return { address: cand, chain: 'sol' };
    }

    return null;
  }

  window.UltraLockDetect = { detectAddress };
})();