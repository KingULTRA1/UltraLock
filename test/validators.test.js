/* eslint-env mocha, node */
require('jsdom-global')();
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

// Load our extension scripts into the test DOM global scope in a safe order
const files = [
  'utils/fingerprint.js',
  'validators/evm.js',
  'validators/btc.js',
  'validators/sol.js',
  'validators/doge.js',
  'validators/ltc.js',
  'utils/canonicalize.js',
  'utils/detect.js',
  'content/overlay.js',
  'content/content.js'
];

// Provide a minimal chrome stub for test environment
global.chrome = global.chrome || { runtime: { getURL: (p) => p } };
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  // Evaluate in the test VM so the IIFEs attach to the global window
  eval(src);
}

describe('UltraLock validators & detect heuristics', () => {
  it('should detect an EVM (eth) address (lowercase accepted)', async () => {
    const input = 'Send to 0xde709f2102306220921060314715629080e2fb77 immediately';
    const res = await window.UltraLockDetect.detectAddress(input);
    expect(res).to.be.an('object');
    expect(res.chain).to.equal('eth');
    expect(res.address.toLowerCase()).to.contain('0xde709f2102306220921060314715629080e2fb77');
  });

  it('should validate a Bitcoin bech32 address', async () => {
    const addr = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080';
    const ok = await window.UltraLockBTC.isBech32(addr);
    // debug when failing
    if (!ok) console.log('bech32 check returned false for', addr);
    expect(ok).to.equal(true);
  });

  it('should validate common Base58Check (1A1z... Satoshi) address', async () => {
    const addr = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    const ok = await window.UltraLockBTC.isValidBase58(addr);
    expect(ok).to.equal(true);
  });

  it('should reject an invalid Bech32 address', async () => {
    const addr = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt08l';
    const ok = await window.UltraLockBTC.isBech32(addr);
    expect(ok).to.equal(false);
  });

  it('should reject an invalid Base58Check address', async () => {
    const addr = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb';
    const ok = await window.UltraLockBTC.isValidBase58(addr);
    expect(ok).to.equal(false);
  });

  it('should accept EVM all-lowercase as valid', async () => {
    const addr = '0xde709f2102306220921060314715629080e2fb77';
    const ok = await window.UltraLockEVM.isValidAddress(addr);
    expect(ok).to.equal(true);
  });

  it('should accept EVM all-uppercase (hex letters) with 0x prefix as valid', async () => {
    const addr = '0xDE709F2102306220921060314715629080E2FB77';
    const ok = await window.UltraLockEVM.isValidAddress(addr);
    expect(ok).to.equal(true);
  });

  it('should be case-insensitive for Bech32 (uppercase variant valid)', async () => {
    const addr = 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KYGT080';
    const ok = await window.UltraLockBTC.isBech32(addr);
    expect(ok).to.equal(true);
  });

  it('should enforce EIP-55 checksum for mixed-case addresses', async () => {
    const validChecksum = '0x52908400098527886E0F7030069857D2E4169EE7';
    const invalidChecksum = '0x52908400098527886E0F7030069857D2E4169Ee7';
    const ok1 = await window.UltraLockEVM.isValidAddress(validChecksum);
    const ok2 = await window.UltraLockEVM.isValidAddress(invalidChecksum);
    expect(ok1).to.equal(true);
    expect(ok2).to.equal(false);
  });

  it('should detect a Solana-like address by base58 length', async () => {
    const sol = 'A'.repeat(44); // valid base58 char repeated to hit length
    const res = await window.UltraLockDetect.detectAddress(sol);
    expect(res).to.be.an('object');
    expect(res.chain).to.equal('sol');
    expect(res.address).to.equal(sol);
  });

  it('should reject non-address text', async () => {
    const res = await window.UltraLockDetect.detectAddress('hello world');
    expect(res).to.equal(null);
  });

  it('should block paste when metadata is mismatched', async () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    el.focus();

    const addr = '0xde709f2102306220921060314715629080e2fb77';
    const mismatchMeta = JSON.stringify({ fingerprint: 'deadbeefcafef00d', chain: 'eth', address: '0xDEADBEEF', ts: Date.now() });

    let blockedMessage = null;
    const origBlocked = window.UltraLockOverlay.showBlocked;
    window.UltraLockOverlay.showBlocked = (msg) => { blockedMessage = msg; };

    const ev = new Event('paste', { bubbles: true, cancelable: true });
    ev.clipboardData = { getData: (type) => { if (type === 'text/plain') return addr; if (type === 'application/x-ultralock+json') return mismatchMeta; return ''; } };
    document.dispatchEvent(ev);

    expect(blockedMessage).to.be.a('string');

    window.UltraLockOverlay.showBlocked = origBlocked;
    el.remove();
  });

  it('should block copy when clipboard has mismatched metadata', async () => {
    // Arrange: set a mismatched in-memory clipboard metadata
    window.__UltraLockLastMetadata = {
      text: '0xDEADBEEF...',
      jsonPayload: JSON.stringify({ fingerprint: 'deadbeefcafef00d', chain: 'eth', address: '0xDEADBEEF' }),
      ts: Date.now()
    };

    // Spy the overlay
    let blockedMessage = null;
    const origBlocked = window.UltraLockOverlay.showBlocked;
    window.UltraLockOverlay.showBlocked = (msg) => { blockedMessage = msg; };

    // Create selection with a valid ETH address
    const el = document.createElement('input');
    document.body.appendChild(el);
    el.value = '0xde709f2102306220921060314715629080e2fb77';
    el.focus();
    el.setSelectionRange(0, el.value.length);

    // Dispatch copy event
    const ev = new Event('copy', { bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    // Assert copy was blocked (blockedMessage set)
    expect(blockedMessage).to.be.a('string');

    // Cleanup
    window.UltraLockOverlay.showBlocked = origBlocked;
    delete window.__UltraLockLastMetadata;
    el.remove();
  });
});
