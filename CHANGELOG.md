# Changelog

## v1.01 (Final) — 2025-12-20

- **Core frozen:** The UltraLock core components (browser script `ultralock.js`, Linux agent `clipwatch`, local bridge, signed helper, bind store, and audit verification tool) are functionally complete and frozen. Only critical security fixes or portability bug fixes will be accepted for the core.
- **Durable binds persistence:** Registered fingerprints and address bindings are durably stored across restarts (atomic writes, 0600 file permissions).
- **Append-only audit log:** Implemented an fsync'd, chained-SHA256 audit log with a small verifier utility (`agents/linux/audit_verify.c`) to detect tampering.
- **Integration tests:** Added `agents/linux/test_persistence.sh` and `agents/linux/test_audit_verify.sh` to validate persistence and audit integrity.
- **Installer & systemd units:** Systemd `--user` units and an installer script added to manage the agent & bridge as user services.
- **Misc:** Headless self-test prints the canonical success line: `address is safe and passed` (used by the automated smoke tests).

---

See `README.md` and `REPORT.md` for usage, verification instructions, and further details.