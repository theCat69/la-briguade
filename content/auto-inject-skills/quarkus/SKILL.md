---
name: quarkus
description: Apply Quarkus service conventions for reactive I/O, CDI/resource boundaries, persistence/config patterns, and Quarkus test layering; do not use outside Quarkus codebases.
detect:
  content:
    - file: pom.xml
      contains: quarkus
    - file: build.gradle
      contains: quarkus
    - file: build.gradle.kts
      contains: quarkus
agents:
  - coder
  - sidekick-reviewer
  - architect
  - feature-designer
  - feature-reviewer
  - planner
  - ask
  - builder
  - orchestrator
---

# Quarkus Skill

## Reactive I/O with Uni and Multi
Use `Uni<T>` for single-value async operations and `Multi<T>` for streams, provided by Mutiny (the Quarkus reactive library). Do not block the event loop. Annotate methods that must block (CPU-bound or legacy code) with `@Blocking` to move execution to a worker thread pool.

## CDI Scope Default
Prefer `@ApplicationScoped` for stateless shared beans. Use `@RequestScoped` when per-request
isolation is required, and `@Dependent` only when the bean lifecycle must follow its injection
point. Follow existing project integration conventions before introducing Spring compatibility
annotations.

## JAX-RS Resources as Thin Routers
JAX-RS resource classes must be thin routers only: parse the request, delegate to a service, and return a response. No business logic, no persistence calls, and no error handling beyond delegating to an `ExceptionMapper`. Keep resource methods short.

## Repository Pattern Only
Follow the existing data-access style consistently. For a new codebase, prefer the Repository
pattern when separating persistence from domain behavior improves testability. Do not mix
Repository and Active Record (`PanacheEntity` static methods) styles without a documented
migration boundary. Test data access independently of the HTTP layer.

## Configuration with ConfigMapping
Group related configuration properties under a `@ConfigMapping`-annotated interface. Do not scatter `@ConfigProperty` field injections across multiple beans for configuration that belongs together. `@ConfigMapping` interfaces are type-safe, support validation, and are easier to test.

## ExceptionMapper for All HTTP Errors
Register a dedicated `ExceptionMapper<E>` for every exception type that should produce a specific HTTP response. Do not catch exceptions inside resource methods and manually build error responses. Centralized exception mapping keeps resource methods clean and ensures consistent error response shapes.

## No Reflection by Default
Avoid reflection when native-image support matters. If reflection is required (for example, by a
third-party library), register affected classes in `reflection-config.json` or with
`@RegisterForReflection`; undeclared reflection can fail in native builds.

## Health Probes
For deployable production services, expose separate `@Liveness` and `@Readiness` probes when the
deployment platform uses them. Liveness indicates whether the process should be restarted;
readiness indicates whether it can receive traffic.

## Metrics on Critical Paths
Annotate critical service methods with `@Counted` and `@Timed` from MicroProfile Metrics. At minimum, instrument all external I/O calls, all cache interactions, and the primary business transaction path. Do not instrument trivial getters or internal utility methods.

## Testing Strategy
- Use `@QuarkusComponentTest` for fast, CDI-only unit tests of service-layer beans when supported
  by the project's Quarkus version. These tests start a minimal CDI container without HTTP or
  database infrastructure and run in milliseconds.
- Use `@QuarkusTest` for integration tests that require the full Quarkus application (HTTP endpoints, real database, messaging).
- Use `@QuarkusIntegrationTest` for tests against the native executable or container image.
- Scope test resources with `@WithTestResource` to avoid polluting unrelated tests.
- For Quarkus 3.22+, verify the Maven Surefire version against the framework's current test
  compatibility guidance before upgrading or configuring test execution.
