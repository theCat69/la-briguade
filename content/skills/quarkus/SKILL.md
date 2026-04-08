---
name: quarkus
description: Quarkus-specific coding guidelines — reactive I/O, CDI scopes, repository pattern, config mapping, and testing strategy
---

# Quarkus Skill

## Reactive I/O with Uni and Multi
Use `Uni<T>` for single-value async operations and `Multi<T>` for streams, provided by Mutiny (the Quarkus reactive library). Do not block the event loop. Annotate methods that must block (CPU-bound or legacy code) with `@Blocking` to move execution to a worker thread pool.

## CDI Scope Default
Use `@ApplicationScoped` as the default CDI scope for all beans. Use `@RequestScoped` only when per-request isolation is explicitly required. Avoid `@Dependent` unless the bean's lifecycle must be tied to its injection point. Never use Spring annotations in a Quarkus project.

## JAX-RS Resources as Thin Routers
JAX-RS resource classes must be thin routers only: parse the request, delegate to a service, and return a response. No business logic, no persistence calls, and no error handling beyond delegating to an `ExceptionMapper`. Keep resource methods short.

## Repository Pattern Only
Use the Repository pattern exclusively for data access. Do not use the Active Record pattern (`PanacheEntity` with static methods called on the entity itself). Do not mix both patterns in the same project. Repository classes must be injected as CDI beans and tested independently of the HTTP layer.

## Configuration with ConfigMapping
Group related configuration properties under a `@ConfigMapping`-annotated interface. Do not scatter `@ConfigProperty` field injections across multiple beans for configuration that belongs together. `@ConfigMapping` interfaces are type-safe, support validation, and are easier to test.

## ExceptionMapper for All HTTP Errors
Register a dedicated `ExceptionMapper<E>` for every exception type that should produce a specific HTTP response. Do not catch exceptions inside resource methods and manually build error responses. Centralized exception mapping keeps resource methods clean and ensures consistent error response shapes.

## No Reflection by Default
Quarkus builds a closed-world assumption at compile time. Do not rely on reflection unless absolutely necessary. If reflection is required (e.g., for a third-party library), register the affected classes in `reflection-config.json` or via `@RegisterForReflection`. Undeclared reflection silently fails in native builds.

## Health Probes
Expose `@Liveness` and `@Readiness` health probes for every production service. Liveness indicates whether the process should be restarted. Readiness indicates whether it can receive traffic. Do not combine both concerns in a single probe.

## Metrics on Critical Paths
Annotate critical service methods with `@Counted` and `@Timed` from MicroProfile Metrics. At minimum, instrument all external I/O calls, all cache interactions, and the primary business transaction path. Do not instrument trivial getters or internal utility methods.

## Testing Strategy
- Use `@QuarkusComponentTest` for fast, CDI-only unit tests of service-layer beans. These tests start a minimal CDI container without HTTP or database infrastructure and run in milliseconds. This is the recommended default test type for service logic since Quarkus 3.22.
- Use `@QuarkusTest` for integration tests that require the full Quarkus application (HTTP endpoints, real database, messaging).
- Use `@QuarkusIntegrationTest` for tests against the native executable or container image.
- Scope test resources with `@WithTestResource` to avoid polluting unrelated tests.
- Requires Maven Surefire plugin ≥ 3.5.4 due to the classloading rewrite introduced in Quarkus 3.22, where tests now run in the same classloader as the runtime.