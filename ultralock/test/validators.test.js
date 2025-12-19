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
  'utils/detect.js'
];

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

  it('should run bech32 validator without throwing (returns boolean)', async () => {
    const addr = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080';
    const ok = await window.UltraLockBTC.isBech32(addr);
    expect(ok).to.be.a('boolean');
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
});
