# iOS — UltraLock v1.01 (Final)

UltraLock v1.01 (Final) — single-file, zero-deps integrity protector for copy/paste on Safari and in-app WebViews.

- Use Safari Web Extension format where applicable; where native clipboard interception is limited, provide a 'Paste into UltraLock' flow (user-activated) or a small app extension to perform verification.
- Integrate pre-transaction checks with wallet apps via URL schemes or app intents where available; always verify canonicalized address + fingerprint prior to transaction confirmation.
- Memory-only metadata and short TTLs are required to minimize risk; do not persist sensitive metadata to disk.
