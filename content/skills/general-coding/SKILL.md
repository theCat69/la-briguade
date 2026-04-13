---
name: general-coding
description: Universal coding best practices — naming, testing philosophy, comments, design principles
---

# General Coding Guidelines

---

## 1. Naming Over Comments

- Use **intention-revealing names** for every variable, function, parameter, class, and module
- A good name answers: *what it is, what it does, why it exists*
- Boolean names use `is`, `has`, `can`, `should` prefixes: `isActive`, `hasPermission`, `canRetry`
- Avoid abbreviations unless universally accepted (`id`, `url`, `dto`, `ctx`)
- Avoid generic names: `data`, `value`, `temp`, `result`, `obj`, `info`
- Name functions after their **single action**: `sendWelcomeEmail()`, not `processUser()`
- If naming something feels hard, the abstraction is likely wrong — reconsider the design

---

## 2. Testing Philosophy — Integration / E2E First

- **Integration tests are the primary safety net** — they test real behavior across layers
- Unit tests for **pure logic only**: data transformations, algorithms, isolated utilities
- **E2E tests** cover the most critical user flows: smoke tests + happy paths
- Tests are **living documentation** — they describe what the system actually does
- Avoid testing implementation details; test **behavior and contracts**
- Prefer fewer, more meaningful tests over many shallow ones
- A test that is hard to write signals bad design — fix the design, not the test

---

## 3. Comments — External Interfaces Only

- **Do** document public APIs, function contracts, parameters, return values, and thrown errors
- **Do** comment non-obvious *why* decisions (workarounds, business rules, gotchas)
- **Don't** comment what the code does — let naming and structure say it
- **Don't** leave commented-out code — version control handles history
- **Don't** write noise comments: `// increment i`, `// return the result`
- The need for a comment inside a function body is a signal to extract a named function

---

## 4. Single Responsibility Principle (SRP)

- Each **function** has one job and fits in a visible screen window (~20–30 lines max)
- Each **class/module** has one cohesive purpose
- If you use "and" to describe what something does — **split it**
- Violation symptoms: deeply nested logic, long parameter lists, flags that change behavior

---

## 5. Open / Closed Principle (OCP)

- Add behavior by writing **new code** — avoid editing working, tested logic
- Use abstractions, interfaces, and composition points to enable extension without touching existing paths
- Every `if/switch` on type is a sign you need polymorphism or a strategy pattern

---

## 6. DRY — Don't Repeat Yourself

- When the same logic appears twice, extract it; when it appears three times, it has earned an abstraction
- **Acceptable duplication**: tests (explicitness beats brevity), diverging concerns that happen to look alike today
- DRY applies to **knowledge**, not just text — duplicate structure with different semantics is fine

---

## 7. KISS — Keep It Simple

- Add complexity only when the **problem requires it**
- Simple code is easier to debug, test, change, and hand off
- Prefer clear, linear logic over clever tricks
- The right abstraction reduces complexity; the wrong one adds it
- If the simplest possible solution works — ship it

---

## 8. High Cohesion / Low Coupling

- **Cohesion**: related logic belongs in the same module; unrelated logic should not
- **Coupling**: modules depend on as little as possible; prefer narrow, stable interfaces over broad ones
- Violation symptoms: a change in one module ripples into many others; a module touches unrelated concerns
- High coupling and low cohesion together signal an architectural smell — address the root, not the symptom

---

## 9. Composition Over Inheritance

- Favor assembling behavior from **focused, independent collaborators**
- Deep class hierarchies tightly couple structure; small composable units flex
- Inheritance expresses **is-a**; use it only when the subtype truly satisfies the parent's contract (Liskov Substitution)
- If you find yourself overriding parent methods to *disable* behavior — you're misusing inheritance

---

## 10. Explicit Error Handling

- **Fail fast**: surface errors at the boundary where they occur, not silently downstream
- Use **typed errors** for expected failure modes — model them as first-class values
- Never silently swallow an error (`catch (e) {}` is a bug waiting to happen)
- Never mix error codes with valid return values — a function either succeeds or throws/returns an error type
- Error messages must be actionable: say what failed *and* what the caller can do about it

---

## 11. Protected Variations

- Wrap **volatile points** behind stable interfaces: external APIs, third-party dependencies, configuration, business rules
- Change impact stays local; dependents never need to feel the tremor
- When a dependency is likely to change (or be replaced), inject it — don't hard-code it
- An abstraction that never varies is over-engineering; one that varies without an abstraction is fragility
