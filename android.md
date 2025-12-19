# Android — UltraLock v1.01 (Final)

UltraLock v1.01 (Final) — single-file, zero-deps integrity protector for copy/paste across platforms (browser, mobile WebView, wallet integrations).

- Supported flows: WebView-based wallets, companion helper apps, or direct in-app WebViews. Prefer in-process verification (canonicalize → fingerprint → verify) and memory-only metadata (no persistence).
- Use Accessibility Service only for explicit, opt-in clipboard monitoring on Android; do not persist metadata to disk.
- For integration, call UltraLock's in-page API or use a small helper to perform fingerprint verification before passing addresses to wallet apps.
