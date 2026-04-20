---
name: unslop-reviewer
description: Run a read-only slop scan and emit pass-ordered structured findings for unslop-coder; never edit files in this skill.
agents:
  - reviewer
---

# Unslop Reviewer

**Purpose**: perform a read-only slop scan and emit a structured findings list.

## Scanning Constraints

- Preserve behavior as the primary invariant when deciding what to flag.
- Prefer deletion candidates over additive changes.
- Favor small, reversible fixes over broad rewrites.
- Identify slop; do not design or apply architectural overhauls.

## Slop Categories (Core Review Scope)

1. **Dead code** — unreachable branches, unused exports/variables/functions, stale
   feature flags, commented-out blocks, and debug leftovers (`console.log`, `print`,
   `debugger`, shipped TODOs).
2. **Duplication** — copy-paste logic, near-identical functions differing only by
   constants, repeated config blocks, and redundant helpers with equivalent behavior.
3. **Needless abstraction** — pass-through wrappers with no logic, single-use layers,
   speculative indirection, and premature generalization for single call sites.
4. **Boundary violations** — hidden coupling, misplaced responsibilities across layers,
   and logic leaking across architectural boundaries.
5. **Weak test coverage** — touched behavior not locked by tests, weak assertions that
   only verify "no error thrown", and untested edge paths.

## Pass Mapping

- **Pass 1** → dead code
- **Pass 2** → duplication
- **Pass 3** → naming + error handling
- **Pass 4** → test coverage gaps

## Findings Schema

Each finding must include:

| Field | Type | Values |
|---|---|---|
| `id` | string | Sequential: `F-1`, `F-2`, ... |
| `file` | string | Relative file path |
| `pass` | integer | `1` to `4` |
| `category` | enum | `dead-code` \| `duplication` \| `abstraction` \| `boundary` \| `naming` \| `error-handling` \| `test` |
| `size` | enum | `S` = line/symbol, `M` = block/function, `L` = cross-file/structural |
| `description` | string | What the slop is and where |
| `fix` | string | Concrete action for the coder to apply |

## Scope Rules

- Default scope is changed files (from `git diff` / caller-provided changed set).
- Full-codebase scanning is allowed only when explicitly requested by caller override.
- Never expand scope on your own.

## Pass-4 Opt-In

Include pass-4 (`test`) findings only when explicitly requested (for example:
"include pass-4 findings" or equivalent override).

## Reduction Override

When the caller explicitly requests reduction mode, prioritize findings that shrink code size.

- Rank dead code, exact duplication, needless wrappers/helpers, redundant guards/locals/imports, and useless comments ahead of naming-only issues.
- Emit naming or error-handling findings only when they directly reduce code size or unblock a safer deletion/consolidation.
- Keep the same pass mapping; only the priority of findings changes.

## Output Format

Emit a **numbered list only**, sorted by pass then file path:

```
1. F-1 | src/auth.ts | pass:1 | dead-code | S | Unused `lodash` import at line 3 | Delete line 3
2. F-2 | src/auth.ts | pass:3 | naming | S | Variable named `data` at line 47 | Rename to `userRecord`
```

If no findings: emit exactly `0 findings — all clean.`

## Critical Rule

**Never edit files.** This skill is strictly read-only and outputs findings only.
