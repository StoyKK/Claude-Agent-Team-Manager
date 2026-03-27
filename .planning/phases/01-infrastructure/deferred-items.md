# Deferred Items — Phase 01 Infrastructure

Items discovered during plan execution that are out of scope for the discovering plan.

---

## From Plan 01-03 (Logger Facade)

### Pre-existing TypeScript error in settings-parser.ts

- **File:** `src/services/settings-parser.ts`, line 22
- **Error:** `TS2345: Argument of type '{ error: number; }[]' is not assignable to parameter of type 'ParseError[]'. Type '{ error: number; }' is missing the following properties from type 'ParseError': offset, length`
- **Root cause:** jsonc-parser's `ParseError` type requires `offset` and `length` fields, but the error object being passed only has `error`. Likely introduced by another parallel agent working on JSONC fix (Plan 01-02).
- **Impact:** `pnpm build` fails. Does not affect logger.ts — confirmed via tsc type-check with no errors on logger.ts specifically.
- **Resolution:** Should be fixed by Plan 01-02 once complete, or requires a standalone fix to settings-parser.ts.
