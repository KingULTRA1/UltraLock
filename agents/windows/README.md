Windows agent prototype — design notes

Goal: Provide a Windows-native agent that can monitor the system clipboard and enforce UltraLock bindings created by the browser layer.

Design:
- Use Win32 APIs (SetClipboardViewer or AddClipboardFormatListener) to detect clipboard changes.
- Read text clipboard formats and detect addresses identical to browser canonicalization.
- Compute fingerprints consistent with UltraLock algorithm and block/replace clipboard contents on mismatch.

Security:
- Store device salt in %LOCALAPPDATA%/UltraLock with restricted ACLs.
- No network calls.

Prototype: `agents/windows/clipwatch_win.c` provides scaffold for AddClipboardFormatListener and an event loop.
