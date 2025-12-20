# iOS — UltraLock v1.01 (Final)

**UltraLock v1.01 (Final)** — single-file, zero-dependency integrity protector for copy/paste operations on Safari and in-app WebViews.  
**Status:** NOT ACTIVE / NOT TESTED.

---

## Overview

UltraLock for iOS ensures that critical copy/paste operations (e.g., cryptocurrency addresses) are verified before use. It is designed as a **lightweight, fully native solution**, without external dependencies.  

Key features:  
- Zero-dependency, single-file implementation.  
- Supports Safari Web Extension format where applicable.  
- Provides user-activated “Paste into UltraLock” flow when native clipboard interception is limited.  
- Pre-transaction verification via URL schemes or app intents where available.  
- Memory-only metadata with short TTLs — **no sensitive data is persisted to disk**.

---

## Prerequisites

- iOS 15+ (or latest supported version).  
- Xcode (minimum version required for signing, no external libraries).  
- Apple Developer account for signing if building from source.  
- Device capable of running Safari or WebView-based apps.

---

## Installation / Setup

1. Clone the repository:

```bash
git clone https://github.com/KingULTRA1/UltraLock.git
cd UltraLock
