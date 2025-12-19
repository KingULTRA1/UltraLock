# CONTRIBUTING

## Coding standards

- Fail-closed, defensive programming is mandatory.
- No network calls for validation logic.
- Prefer small, self-contained validator modules under `validators/`.
- Keep metadata memory-only and ephemeral.

## Validator extension guide

1. Add a new file to `validators/` that exposes a conservative validator API (strict regex + checksum).
2. Update `utils/detect.js` to include the new chain's detection heuristics.
3. Add tests and documentation for any new chain.

## Security review rules

- All changes that affect detection, canonicalization, or clipboard behavior require an explicit security review.
- No automatic address correction is permitted.
