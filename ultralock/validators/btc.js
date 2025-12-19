(function () {
  'use strict';

  const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  function base58Decode(s) {
    const bytes = [0];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const val = BASE58_ALPHABET.indexOf(c);
      if (val === -1) throw new Error('Invalid base58 char');
      for (let j = 0; j < bytes.length; ++j) bytes[j] *= 58;
      bytes[0] += val;
      let carry = 0;
      for (let k = 0; k < bytes.length; ++k) {
        const x = bytes[k] + carry;
        bytes[k] = x & 0xff;
        carry = x >> 8;
      }
      while (carry) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }
    // convert to Uint8Array and account for leading zeros
    const zeros = s.match(/^1+/);
    const leadingZeros = zeros ? zeros[0].length : 0;
    const out = new Uint8Array(leadingZeros + bytes.length);
    for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i];
    return out;
  }

  function validateBase58Check(s) {
    try {
      const dec = base58Decode(s);
      if (dec.length < 4) return false;
      const payload = dec.slice(0, dec.length - 4);
      const checksum = dec.slice(dec.length - 4);
      // double SHA256
      return window.UltraLockFingerprint.sha256Hex(Array.from(payload).map((b) => String.fromCharCode(b)).join('')).then((h) => {
        return window.UltraLockFingerprint.sha256Hex(hexToUtf8(h)).then((h2) => {
          const full = h2;
          const first4 = hexToBytes(full).slice(0, 4);
          return arrEqual(first4, checksum);
        });
      }).catch(() => false);
    } catch (err) {
      return Promise.resolve(false);
    }
  }

  function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return new Uint8Array(bytes);
  }

  function hexToUtf8(hex) {
    return hexToBytes(hex).map((b) => String.fromCharCode(b)).join('');
  }

  function arrEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Bech32 decode (BIP-173) — minimal implementation to validate
  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function bech32Polymod(values) {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (let p = 0; p < values.length; ++p) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ values[p];
      for (let i = 0; i < 5; ++i) if ((top >> i) & 1) chk ^= GEN[i];
    }
    return chk;
  }

  function bech32HrpExpand(hrp) {
    const ret = [];
    for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) >> 5);
    ret.push(0);
    for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) & 31);
    return ret;
  }

  function isValidBech32(addr) {
    const lower = addr.toLowerCase();
    const pos = lower.lastIndexOf('1');
    if (pos < 1 || pos + 7 > lower.length) return false;
    const hrp = lower.slice(0, pos);
    const data = lower.slice(pos + 1);
    const values = [];
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const v = BECH32_CHARSET.indexOf(c);
      if (v === -1) return false;
      values.push(v);
    }
    const chk = bech32Polymod(bech32HrpExpand(hrp).concat(values));
    return chk === 1;
  }

  // Exposed API
  async function isBech32(addr) {
    try { return isValidBech32(addr); } catch (e) { return false; }
  }

  async function isValidBase58(addr) {
    try { return await validateBase58Check(addr); } catch (e) { return false; }
  }

  window.UltraLockBTC = { isBech32, isValidBase58 };
})();