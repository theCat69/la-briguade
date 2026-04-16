---
name: typescript
description: TypeScript-specific coding guidelines — strict typing, runtime validation, discriminated unions, and error patterns
detect:
  files:
    - tsconfig.json
agents:
  - coder
  - reviewer
  - architect
  - feature-designer
  - feature-reviewer
  - planner
  - ask
  - builder
  - orchestrator
---

# TypeScript Skill

## Compiler Strictness
Always enable `strict: true`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` in `tsconfig.json`. These three flags together catch the majority of runtime type errors at compile time.

## Unknown Over Any
Prefer `unknown` over `any`. When a value's type is truly unknown, require an explicit type guard or narrowing before use. `any` silently disables type checking and must never appear in production code without a documented justification.

## Runtime Validation
Validate all external data (API responses, user input, environment variables) at the boundary using a schema library such as Zod or Valibot. TypeScript types alone do not protect against malformed runtime data.

## Discriminated Unions for State
Model state machines and variants with discriminated unions (`{ kind: "success"; value: T } | { kind: "error"; message: string }`). Never use boolean flags or optional fields to represent mutually exclusive states.

## Interface vs Type
Use `interface` for object shapes that may be extended or implemented by classes. Use `type` for unions, intersections, mapped types, and aliases for primitives. Do not use `interface` for union types.

## Utility Types First
Exhaust TypeScript's built-in utility types (`Partial`, `Required`, `Pick`, `Omit`, `Readonly`, `Record`, `ReturnType`, `Parameters`, etc.) before creating new types. Custom mapped types should be a last resort.

## Const and Satisfies
Use `as const` to freeze literal values and narrow their types. Use `satisfies` to validate that a value conforms to a type without widening it. Prefer `satisfies` over type annotations when you want both inference and validation.

## Import Type
Always use `import type { ... }` for type-only imports. This ensures the import is erased at compile time and avoids accidental runtime dependencies.

## Generic Constraints
Add explicit constraints to generic type parameters (`<T extends object>`, `<T extends string>`). Unconstrained generics (`<T>`) accept `null` and `undefined` unless strictness flags prevent it, and reduce IDE assistance.

## Result Pattern
Model recoverable errors as `Result<T, E>` discriminated unions instead of throwing exceptions or returning `null`. Reserve `throw` for truly unrecoverable programmer errors. This makes error paths explicit and type-safe.

## No Type Assertions
Avoid `value as SomeType` assertions. They suppress compiler errors and lie about the type of a value. Use type guards (`function isFoo(v: unknown): v is Foo`) or narrowing instead. The only acceptable assertion is `as unknown as T` when bridging intentionally incompatible types with a documented reason.

## Folder Organization
Place all shared types in a dedicated `types/` folder at the appropriate scope (feature-level or module-level). Co-locate types that are only used by a single module next to that module. Never scatter type declarations across implementation files.
