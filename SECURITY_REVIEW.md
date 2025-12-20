UltraLock v1.01 — Security Review Checklist

Purpose: Short, concrete checklist and remediation notes used for the final build and release.

1) Deterministic fingerprinting
- Verify fingerprint uses (canonical_payload || execution_context || device_salt || session_nonce) and uses SHA-256.
- Confirm device salt is per-device and persistent; session nonce per page load.
- Confirm canonicalization removes invisibles & normalizes casing for relevant formats.

2) Clipboard binding & storage
- Confirm binding occurs at copy-time only when a sensitive payload is detected.
- Confirm clipboard metadata is stored under `application/x-ultralock+json` when supported; memory fallback present and TTL enforced.
- Confirm no network call is performed during bind or verify.

3) Paste verification
- Confirm paste-time verification recomputes fingerprint and blocks on mismatch with visible alert.
- Confirm invisible characters are detected and cause the paste to be blocked.

4) UI & enforcement
- Confirm lock UI reflects the actual enforcement state and is not purely cosmetic.
- Confirm secure elements are made read-only and non-selectable and provide a dedicated copy action.

5) Monitoring
- Confirm clipboard polling is conservative (default 750ms) and does not exfiltrate data.
- Confirm mutation detection on pasted fields disables editing when divergence is detected.

6) Attack surface & hardening
- Confirm no remote resources are loaded; no analytics or telemetry.
- Confirm minimal global namespace exposure: `window.UltraLock` for API, `UltraLockInternal` for test-only helpers.
- Confirm all error paths handle exceptions and show blocking alerts when appropriate.

7) Tests & verification
- Unit tests for canonicalization, detectAddress, and computeFingerprint exist and pass in the browser.
- Integration tests simulate copy→bind→paste flows and verify blocking and allow cases.

8) Release hygiene
- Confirm README contains the exact required title: `# UltraLock 🔒` and live test vectors.
- Confirm release notes (`RELEASE_NOTES.md`) and test checklist (`TESTS.md`) accompany the build.
- Tag release `v1.01` and include the concise release artifacts.

Remediation notes (if any failure is found)
- Any failure requiring code changes must be fixed before tagging.

