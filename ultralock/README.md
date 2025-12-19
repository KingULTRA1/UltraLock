# UltraLock

One-paragraph overview

UltraLock is a fail-closed transaction integrity control that prevents clipboard copy-paste hijacking for cryptocurrency wallet addresses. It binds cryptographic fingerprints to canonicalized addresses on copy and enforces strict validation on paste and during post-paste DOM mutation, blocking execution if integrity is violated.

## Threat model (summary)

- Mitigates clipboard hijacking, DOM mutation-based address swapping and opportunistic copy-paste attacks. 
- Does not rely on external network checks and uses deterministic, chain-aware validators.

## Supported chains

- Bitcoin (BTC) — Base58 + Bech32
- Ethereum / EVM (ETH) — EIP-55 checksum enforced
- Wrapped BTC (WBTC) — ERC-20 (EVM rules)
- Wrapped ETH (WETH) — ERC-20 (EVM rules)
- Solana (SOL) — Base58 length + character rules
- Dogecoin (DOGE) — Base58 + prefix checks
- Litecoin (LTC) — Base58 + Bech32

Additional chains can be added by implementing the validator interface in `validators/`.

## How it works (copy → paste → verify)

1. COPY: On copy, detect a valid address, canonicalize it, compute SHA-256, truncate to first 16 chars, and write both `text/plain` and `application/x-ultralock+json` payloads to the clipboard. Visual indicator shows lock.
2. PASTE: On paste, the extension intercepts the event, reads plain text and metadata, recomputes fingerprint, and allows or blocks the operation deterministically (fail-closed on mismatch or missing metadata).
3. POST-PASTE: The extension monitors DOM mutations for pasted fields; if the address is changed or mutates, the input is disabled and the UI blocked immediately.

## Why fail-closed matters

Fail-closed means when the system cannot deterministically verify integrity, it blocks the operation. This prevents accommodation of ambiguous or uncertain states that could lead to a silent compromise.

---

See `SECURITY.md` for a detailed threat breakdown and responsible disclosure instructions.
