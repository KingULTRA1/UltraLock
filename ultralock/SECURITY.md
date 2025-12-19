# SECURITY

## Threats mitigated

- Clipboard hijacking and clipboard-manipulation attacks
- Copy-time detection of pre-hijacked addresses (if clipboard metadata exists and mismatches the selection)
- Context-menu and keyboard paste compromise when metadata mismatches
- DOM mutation attacks that swap addresses after paste
- Replay of old metadata via timestamp expiration

## Copy-time alert

If a user copies an address and the clipboard already contains UltraLock metadata that does not match the selected address (fingerprint or chain mismatch), UltraLock will immediately block the copy and show the following critical alert:

"⚠️ Attention: The address you copied does not match the original verified address. UltraLock enabled. This transaction is NOT secure. Recommendation: Clear your browser or use another device for this transaction."

This is a fail-closed protective measure to prevent propagation of already-compromised addresses.

## Threats explicitly not mitigated

- Compromised browser that can intercept process memory
- Malicious browser extension running with higher privileges that hooks internal APIs
- User-operated manual changes to addresses after paste (we detect and block subsequent mutation)

## Responsible disclosure

Please report security issues to security@example.com with details and reproduction steps. Do not publish disclosures publicly before providing maintainers with 90 days to respond.

## Legal disclaimer

This project is provided "as-is". Maintainers disclaim liability for any loss or damages arising from use.
