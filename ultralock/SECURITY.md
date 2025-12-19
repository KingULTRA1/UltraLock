# SECURITY

## Threats mitigated

- Clipboard hijacking and clipboard-manipulation attacks
- Context-menu and keyboard paste compromise when metadata mismatches
- DOM mutation attacks that swap addresses after paste
- Replay of old metadata via timestamp expiration

## Threats explicitly not mitigated

- Compromised browser that can intercept process memory
- Malicious browser extension running with higher privileges that hooks internal APIs
- User-operated manual changes to addresses after paste (we detect and block subsequent mutation)

## Responsible disclosure

Please report security issues to security@example.com with details and reproduction steps. Do not publish disclosures publicly before providing maintainers with 90 days to respond.

## Legal disclaimer

This project is provided "as-is". Maintainers disclaim liability for any loss or damages arising from use.
