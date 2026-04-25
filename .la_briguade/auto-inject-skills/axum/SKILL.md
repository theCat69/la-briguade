---
name: axum
description: Axum production guidance for routing boundaries, middleware layering, extractor correctness, and resilient error handling.
detect:
  content:
    - file: Cargo.toml
      contains: "axum ="
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

This skill provides production Axum guidance for structuring routers and middleware layers, applying extractors correctly, and handling HTTP errors predictably in Rust services.

## Scope

- **In scope**: Axum router composition, middleware ordering, extractor usage,
  response/error modeling, and server-side request handling.
- **Out of scope**: UI/client concerns and non-Axum Rust HTTP stacks.

## Invariants

- Keep route handlers focused: parse input, call domain logic, return typed HTTP responses.
- Compose middleware with `tower::ServiceBuilder` when multiple layers are required.
- Treat middleware order as explicit behavior; add layers intentionally and document security-critical order.
- Apply layers at the correct router scope so only intended routes inherit behavior.
- Use explicit error mapping for fallible middleware/handlers; avoid silent fallthrough.

## Validation Checklist

- Validate implementation choices against official docs:
  - https://docs.rs/axum/latest/
  - https://docs.rs/axum/latest/axum/middleware/
- Confirm middleware layering order matches the intended request/response pipeline.
- Verify extractors and state access remain type-safe and minimal.
- Run build/tests and verify expected status codes, headers, and error responses.

## Failure Handling

- If middleware behavior is ambiguous, stop and specify order and scope before continuing.
- If a middleware can fail, introduce explicit `HandleErrorLayer` handling rather than ad-hoc panics.
- If handler logic mixes transport and business concerns, split domain logic into service functions.

## High-Value Axum Practices

- Group routes by capability and apply shared middleware at group boundaries.
- Keep auth, tracing, and timeout middleware composable and independently testable.
- Prefer strongly typed extractors over manual request parsing in handlers.
- Normalize error responses so clients receive consistent machine-readable failure shapes.
