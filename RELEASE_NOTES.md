UltraLock v1.01 — Release notes

This release is a clean-slate, hardened implementation focused on the Browser Enforcement Layer and live, verifiable proof.

Included:
- `ultralock.js`: clean-slate browser enforcement layer implementing deterministic fingerprinting, binding, monitoring, and fail-closed paste blocking.
- `test.html`: manual test harness with real BTC address and Lightning invoice and automation helpers.
- `README.md`: updated to exact title `# UltraLock 🔒` and live test vectors.
- `DESIGN.md`, `TESTS.md`: design and verification documentation.
- `agents/linux/`: prototype scaffold for system-level clipboard agent on Linux.

Next steps:
- Implement and test OS-level agents for Windows and macOS.
- Add automated tests and CI checks for canonicalization & fingerprinting.
- Formal security review and community audit.
