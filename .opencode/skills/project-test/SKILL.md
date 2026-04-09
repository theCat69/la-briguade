---
name: project-test
description: Testing guidelines, Vitest conventions, patterns, and coverage requirements for la-briguade
---

## Test Framework

- **Vitest v3** — `vitest run` for CI (single pass), `vitest` for watch mode
- **Environment**: `node` — this is a CLI/plugin project, not a browser app; never use `jsdom`
- **Coverage provider**: `v8`
- **Globals**: `true` recommended in `vitest.config.ts` (or use explicit imports from `vitest`)

## Test Location & File Naming

- **Co-located tests alongside source**: place test files next to the module they test
  - `src/utils/frontmatter.test.ts`
  - `src/utils/read-dir.test.ts`
  - `src/plugin/agents.test.ts`
  - `src/plugin/commands.test.ts`
  - `src/hooks/index.test.ts`
- No separate `__tests__/` directory
- File suffix: `.test.ts` (not `.spec.ts`)

## Writing Tests

### AAA Pattern — Arrange → Act → Assert

```typescript
describe("parseFrontmatter", () => {
  it("should return empty attributes when no frontmatter fence is present", () => {
    // Arrange
    const input = "# Heading\nSome body text.";

    // Act
    const result = parseFrontmatter(input);

    // Assert
    expect(result.attributes).toEqual({});
    expect(result.body).toBe(input);
  });
});
```

### Describe Blocks

- `describe` block name matches the module or function under test
- `it` descriptions use `"should ..."` prefix describing observable behavior
- Group related cases under nested `describe` blocks for complex functions

### What to Test

- **Test observable behavior** (return values, side effects like `console.warn`)
- **Do NOT test implementation details** (internal variable names, private logic)
- Test edge cases: missing frontmatter, malformed YAML, empty directories, missing files
- Integration-first: prefer testing the full `registerAgents(input, contentDir)` pipeline over only `parseFrontmatter`

## Mocking & Fixtures

```typescript
import { vi, afterEach, describe, it, expect } from "vitest";

// Mock Node built-ins
vi.mock("node:fs");

// Spy on console.warn
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

// Always restore after each test
afterEach(() => {
  vi.restoreAllMocks();
});
```

- Inline fixtures as constants inside the test file — no external fixture files unless the fixture exceeds ~50 lines
- Use `vi.fn()` for callbacks; `vi.mock()` for modules; `vi.spyOn()` for side effects
- Always call `vi.restoreAllMocks()` in `afterEach` — never let mocks leak between tests

## Coverage Requirements

| Module | Target |
|---|---|
| `src/utils/` | ≥ 80% line coverage |
| `src/plugin/` | ≥ 80% line coverage |
| `src/hooks/` | ≥ 70% line coverage (integration-level) |
| `src/cli/` | Lower priority — test via integration at plugin level |

Run with coverage:

```bash
npx vitest run --coverage
```

Recommended `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
      include: ["src/utils/**", "src/plugin/**"],
    },
  },
});
```

## Running Tests

```bash
npm test             # vitest run — single pass (use in CI)
npm run test:watch   # vitest — watch mode (use during development)
npx vitest run --coverage  # with coverage report
```

> No test directory currently exists in the repository. When adding the first test, also add `vitest.config.ts` at the project root.
