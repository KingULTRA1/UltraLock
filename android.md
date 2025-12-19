# Android Integration Notes

- Use an Accessibility Service for broad clipboard monitoring (with privacy-preserving design and opt-in only).
- Alternatively, use a lightweight background clipboard watcher combined with a small helper app that enforces address integrity before handing a value to a wallet app.
- For WebView-based wallets, integrate a local JavaScript bridge to intercept paste events and perform fingerprint verification in-process.
- Do not persist metadata to disk; keep TTL and memory-only semantics identical to the browser extension.
