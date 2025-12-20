UltraLock — Design & Threat Model (v1.01)

Purpose
- UltraLock enforces clipboard integrity at the moment of use. If the data changes, the operation is blocked.
- This document records the design decisions and threat model for the clean-slate implementation.

Clipboard Enforcement Pipeline
- Copy → Bind → Monitor → Verify → Paste
  - Copy: intercept copy actions and identify "sensitive payloads" (BTC, LN invoices, crypto IDs, URLs).
  - Bind: compute SHA-256 fingerprint of a canonical payload combined with execution context + device-derived salt + session nonce. Store as clipboard metadata (custom MIME) and in ephemeral memory.
  - Monitor: poll clipboard and observe DOM for mutations, invisible char injection, truncation, encoding changes, and race/timing attacks.
  - Verify: at paste time recompute fingerprint for the pasted payload and compare to last bound fingerprint.
  - Paste: allow only when fingerprints match; otherwise prevent and show blocking alert.

Fingerprint details
- fingerprint = SHA-256(canonical_payload || '||' || execution_context || '||' || device_salt || '||' || session_nonce)
- execution_context includes location.origin, UA, and document.title
- device_salt is persistent per device (stored in localStorage when available); session_nonce rotates each page load
- Using context and salt narrows replay windows and raises attacker cost

Address Lock Mechanism
- Address-containing elements can be "secured" which sets them to readOnly and non-selectable, and surfaces a dedicated "Copy (UltraLock)" action which performs canonical binding.
- The lock UI shows canonical fingerprint and short deterministic checksum (first/last characters).
- The enforcement is behavioral: paste-time verification is authoritative.

Threat model (explicit coverage)
- Clipboard hijackers: detected via missing metadata or mismatched fingerprint; paste blocked
- Background clipboard malware and race attacks: monitored by polling clipboard and verifying timestamps and canonical text
- DOM mutation attacks: post-paste mutation is detected by disabling the field and showing an alert if the content diverges from canonical
- Extension-based substitution: mitigated by binding metadata and verifying at paste time; extensions would have to match fingerprint to succeed
- Invisible character injection and encoding abuse: detected via character-set checks and normalization; paste blocked on invisibles

Scope & Limitations
- Browser Enforcement Layer: fully implemented (zero-deps single JS file). Works best in secure contexts (https) and when Clipboard APIs are available. Memory fallback works in single-tab scenarios.
- OS-Agent Prototype: scaffolding included in this repo. Full system-wide agents will require platform-specific native code (C/Go/Rust) to hook into system clipboards and run as background services. The repo includes a design and a Linux C prototype plan (next steps).
- No external telemetry, no network calls, and no trust assumed from host environment.

Audit & Extensibility
- Minimal attack surface and clear separation: detection, canonicalization, fingerprinting, storage, verification, UI.
- Inline comments explain every security decision.

Next steps
- Produce OS-level agent prototypes (Linux C agent skeleton) and packaging instructions for Windows/macOS.
- Add automated threat coverage checks (manual scripts & integration tests) and a formal security review checklist.
