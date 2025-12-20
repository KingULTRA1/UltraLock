macOS agent prototype — design notes

Goal: Provide a macOS agent (Objective-C / Swift) that monitors NSPasteboard changes and enforces bindings.

Design:
- Poll NSPasteboard.generalPasteboard.changeCount periodically or use NSPasteboard change notifications on newer APIs.
- Read string contents, canonicalize, compute fingerprint matching browser logic, and if mismatched replace with blocking fallback or notify user.

Security:
- Device salt stored in ~/.local/share/ultralock or in Keychain; choose a private, auditable storage with restricted permissions.

Prototype: add `agents/macos/clipwatch.m` scaffold.
