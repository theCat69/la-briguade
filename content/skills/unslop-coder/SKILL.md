---
name: unslop-coder
description: Applies a pre-computed unslop findings list — targeted edits only, no scanning
---

# Unslop Coder

**Purpose**: apply a pre-computed findings list from `unslop-reviewer`.

This skill is implementation-only: it **edits files** to apply listed findings.
It is not a scanning skill.

## What You'll Be Fixing

Findings target one of these slop categories:

1. **Dead code** — unreachable branches, unused exports/variables/functions, stale
   feature flags, commented-out blocks, and debug leftovers (`console.log`, `print`,
   `debugger`, shipped TODOs).
2. **Duplication** — copy-paste logic, near-identical functions that differ only by a
   constant, repeated config blocks, or redundant helpers doing the same work.
3. **Needless abstraction** — pass-through wrappers with no logic, single-use layers,
   speculative indirection, or premature generalization with only one real call site.
4. **Boundary violations** — hidden coupling across modules, misplaced
   responsibilities (business logic in a view layer, I/O in pure logic), or cross-layer
   leakage.
5. **Weak test coverage** — touched behavior not locked by tests, assertions that only
   check "no error thrown", and missing edge cases on modified paths.

## Input Format

The calling prompt provides a findings list in the format produced by `unslop-reviewer`:

```
1. F-1 | src/auth.ts | pass:1 | dead-code | S | Unused `lodash` import at line 3 | Delete line 3
2. F-2 | src/auth.ts | pass:3 | naming | S | Variable named `data` at line 47 | Rename to `userRecord`
…
```

Apply **only** listed findings. Do not scan for additional slop. Do not apply fixes not
present in the list.

---

## Application Mechanics

- Apply findings strictly in **pass order**: pass 1 → pass 2 → pass 3 → pass 4.
- Within each pass, process findings by **file path**.
- Never touch files outside caller-provided scope.
- Apply only the requested fix; do not add opportunistic refactors.

## Non-Negotiable Constraints

- **Preserve observable behavior**. Slop cleanup is a scalpel, not a rewrite.
- Prefer deletion over addition, but never delete speculatively.
- **Test-before-delete**: if deletion may affect side effects, lock behavior with a test
  first, then delete.
- This skill **always edits files**; it is not for read-only review.

---

## Test-Writing Behavior

Test writing is **opt-in**. Only write new tests when the calling prompt explicitly
states that **test-writing override is active**.

When active: for each pass-4 finding, write targeted tests that lock the described
behavior. Every test must assert a meaningful outcome (not only "no error thrown").
Co-locate tests with existing project test files.

When not active: skip pass-4 implementation. Report those findings as deferred gaps.

---

## Output (≤ 300 tokens)

- **Files touched** — list modified files
- **Applied findings** — one line per finding: `F-id: <what was done>`
- **Skipped findings** — each skipped finding with reason (out of scope, ambiguous fix,
  unsafe change, etc.)
- **Pass-4 gaps** — when override is not active, list deferred pass-4 findings
- **Risks** — remaining risk areas that could not be safely cleaned in-scope
