---
name: nextjs
description: Next.js App Router production guidance for rendering strategy, data boundaries, caching, and runtime behavior in Next.js projects.
detect:
  files:
    - next.config.js
    - next.config.mjs
    - next.config.ts
  content:
    - file: package.json
      contains: '"next"'
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

## Scope

- **In scope**: Next.js App Router architecture, Server/Client Component boundaries, data
  fetching and caching, and production-ready routing/error patterns.
- **Out of scope**: generic React fundamentals already covered by the `react` skill,
  non-Next bundler tooling, and backend platform operations.

## Invariants

- Prefer **Server Components by default**; add `"use client"` only where browser APIs or
  interactive state are required.
- Keep data access and secrets on the server boundary (Route Handlers, Server Actions,
  server-only modules).
- Use `next/link` for internal navigation and preserve App Router conventions
  (`layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`).
- Define caching behavior intentionally (`fetch` cache options, revalidation strategy,
  dynamic/static rendering) instead of relying on implicit defaults.
- Treat metadata, images, and fonts as first-class performance work
  (`generateMetadata`, `next/image`, `next/font`).

## Validation Checklist

- Read the official docs before implementing non-trivial behavior:
  - https://nextjs.org/docs/app/guides/production-checklist
  - https://nextjs.org/docs/app/guides
- Verify route-level UX states exist where relevant (`loading`, `error`, `not-found`).
- Run project validation commands (build + tests) and ensure no Next.js runtime warnings
  are introduced.

## Failure Handling

- If an implementation requires breaking App Router conventions, stop and document the
  constraint before proceeding.
- If rendering or cache mode is ambiguous, choose explicit configuration and record the
  reason in code-level docs.
- If a feature leaks server-only logic to client bundles, block the change until the
  boundary is corrected.

## High-Value Next.js Practices

- Use nested layouts to avoid duplicating shell UI and to enable partial rendering.
- Keep Server Actions small and side-effect focused; validate inputs at the action
  boundary.
- Use route handlers for HTTP integration boundaries and normalize error responses.
- Prefer incremental, route-segment level optimization over app-wide toggles.
