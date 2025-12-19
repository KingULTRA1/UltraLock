# iOS Integration Notes (Safari Web Extension)

- Use Safari Web Extension format to package the extension for iOS/macOS.
- Clipboard interception on iOS is limited; perform integrity checks in a small app extension or via user-activated 'Paste into UltraLock' flow when native interception is unavailable.
- Implement pre-transaction checks by integrating with target wallet apps via URL schemes or app intents, providing the canonicalized address and fingerprint for verification prior to transaction confirmation.
- Ensure memory-only handling of any metadata and TTL enforcement similar to the browser extension.
