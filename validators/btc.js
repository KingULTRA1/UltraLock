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

  async function sha256Raw(bytes) {
    // bytes: Uint8Array
    const buffer = bytes.buffer ? bytes.buffer : (new Uint8Array(bytes)).buffer;
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(digest);
  }

  function validateBase58Check(s) {
    try {
      const dec = base58Decode(s);
      if (dec.length < 4) return false;
      const payload = dec.slice(0, dec.length - 4);
      const checksum = dec.slice(dec.length - 4);
      return sha256Raw(payload).then((h1) => sha256Raw(h1).then((h2) => {
        const first4 = h2.slice(0, 4);
        return arrEqual(first4, checksum);
      })).catch(() => false);
    } catch (err) {
      return Promise.resolve(false);
    }
  }

  function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return new Uint8Array(bytes);
  }

  function arrEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Bech32 decode (BIP-173) — minimal implementation to validate
  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function polymodStep(pre) {
    const b = pre >>> 25;
    return ((pre & 0x1ffffff) << 5) ^
      ((b & 1) ? 0x3b6a57b2 : 0) ^
      ((b & 2) ? 0x26508e6d : 0) ^
      ((b & 4) ? 0x1ea119fa : 0) ^
      ((b & 8) ? 0x3d4233dd : 0) ^
      ((b & 16) ? 0x2a1462b3 : 0);
  }

  function bech32Polymod(values) {
    let chk = 1;
    for (let p = 0; p < values.length; ++p) chk = polymodStep(chk) ^ values[p];
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
    if (!addr || typeof addr !== 'string') return false;
    // Must be all lower or all upper (no mixed case)
    const hasLower = /[a-z]/.test(addr);
    const hasUpper = /[A-Z]/.test(addr);
    if (hasLower && hasUpper) return false;

    const lower = addr.toLowerCase();
    const pos = lower.lastIndexOf('1');
    if (pos < 1) return false;
    const hrp = lower.slice(0, pos);
    const data = lower.slice(pos + 1);
    if (data.length < 6) return false; // checksum length

    const values = new Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const v = BECH32_CHARSET.indexOf(c);
      if (v === -1) return false;
      values[i] = v;
    }

    const chk = bech32Polymod(bech32HrpExpand(hrp).concat(values));
    // checksum value for valid bech32 should be 1
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