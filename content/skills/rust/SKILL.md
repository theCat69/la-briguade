---
name: rust
description: Rust-specific coding guidelines — ownership, error handling, traits, async, testing, Cargo, and safety conventions
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

# Rust Skill

## Ownership and Borrowing First
Design APIs to borrow by default (`&T` / `&mut T`) and take ownership only when ownership transfer is part of the contract. Clone only at explicit boundaries (serialization, caching, cross-thread handoff), and prefer `Copy` only for tiny trivially-copyable types.

- Prefer `&str` in function parameters to borrow text without taking ownership.
- Use `String` for owned values in struct fields and return types.
- Avoid `.to_string()` / `.to_owned()` in hot loops; convert once at the boundary.

## Lifetimes
- Rely on lifetime elision in simple cases; do not annotate lifetimes unnecessarily.
- Add explicit lifetimes when signatures involve multiple borrowed inputs/outputs with different lifetimes.
- Add explicit lifetimes on structs/enums that store references, and on trait objects when required by bounds.
- Use `'static` bounds only when genuinely required by the API/runtime; do not use `'static` on trait objects as a workaround.
- Never return references to locally created values; return an owned type instead (`String`, `Vec<T>`, owned struct).

## Error Handling with Result, Not Panic
Return `Result<T, E>` for recoverable failures and use `?` pervasively to propagate errors. In libraries, define concrete error enums with `thiserror`; in applications, use `anyhow` or `eyre` for top-level error aggregation. Never use `.unwrap()` or `.expect()` in production paths without a documented, provable invariant.

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("missing key: {0}")]
    MissingKey(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

pub fn load_config(path: &std::path::Path) -> Result<String, ConfigError> {
    let raw = std::fs::read_to_string(path)?;
    if raw.is_empty() {
        return Err(ConfigError::MissingKey("app.name".to_string()));
    }
    Ok(raw)
}
```

## Strong Type Modeling
Use newtypes to encode invariants and domain meaning; use type aliases only for readability. Prefer generics for zero-cost static dispatch, and use `dyn Trait` only when runtime polymorphism is required. Move complex bounds into `where` clauses for readability.

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserId(String);

impl TryFrom<String> for UserId {
    type Error = &'static str;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.trim().is_empty() {
            return Err("user id must not be empty");
        }
        Ok(Self(value))
    }
}
```

## Trait Implementations and Orphan Rule
Implement standard traits (`Debug`, `Display`, `Error`, `Default`, `Clone`/`Copy`, `Iterator`, `From`/`Into`) when they improve ergonomics and interoperability. Respect the orphan rule: when you need to implement a foreign trait for a foreign type, introduce a local newtype wrapper.

## Enums and Exhaustive Pattern Matching
Model state and variants with enums and prefer exhaustive `match` expressions. Use `#[non_exhaustive]` on public enums intended for extension. Avoid wildcard (`_`) arms unless the fallback behavior is intentional and documented.

## Memory and Performance Discipline
Prefer stack allocation and borrowing before heap allocation. Use `Box<T>` for indirection (including recursive types), `Rc<T>` for shared single-thread ownership, and `Arc<T>` for shared cross-thread ownership. Add `Mutex`/`RwLock` only when mutation is truly needed. Profile first; never optimize blindly.

## Async and Concurrency Rules
Use Tokio for production async runtime unless a project standard says otherwise. Do not perform blocking operations inside async tasks; use `spawn_blocking` for CPU/blocking work. Mark functions `async` only when they perform real async work, and ensure spawned tasks satisfy `Send`/`Sync` requirements.

- `async fn` in traits (RPITIT) is stable on Rust 1.75+; prefer it for new code.
- Use `#[async_trait]` only when targeting older stable Rust or when object safety is required.

```rust
use tokio::task;

pub async fn hash_file(path: std::path::PathBuf) -> Result<u64, std::io::Error> {
    let data = tokio::fs::read(path).await?;
    let checksum = task::spawn_blocking(move || {
        data.iter().fold(0u64, |acc, b| acc.wrapping_add(*b as u64))
    })
    .await
    .map_err(std::io::Error::other)?;
    Ok(checksum)
}
```

## Testing Layers and Contracts
Keep unit tests in `#[cfg(test)]` modules and integration tests in `tests/`. Use `#[should_panic]` only for explicit panic contracts. Add property-based tests (`proptest`/`quickcheck`) for invariants and edge-heavy logic. Ensure doctests compile and assert real behavior.

## Iterators
- Prefer iterator adapters (`map`, `filter`, `flat_map`, `collect`, `fold`) over manual `for` loops for data transformations.
- Keep chains lazy; avoid collecting into an intermediate `Vec` unless it is truly needed.
- Return `impl Iterator<Item = T>` for custom iterator-producing APIs.

## Serialization (serde)
- `#[derive(Serialize, Deserialize)]` is idiomatic for data types crossing process/network/storage boundaries.
- Set casing explicitly with `#[serde(rename_all = "camelCase")]` or `#[serde(rename_all = "snake_case")]`; never rely on implicit casing.
- Use `#[serde(skip_serializing_if = "Option::is_none")]` for optional wire-format fields.
- Validate untrusted data after deserialization; `serde` validates structure, not business rules.

## Cargo Workspaces and Dependency Hygiene
Use workspace roots with shared `[workspace.dependencies]` and explicit crate editions (`2021` or `2024`). Match resolver to edition: use `resolver = "2"` for edition 2021 and `resolver = "3"` for edition 2024. Use feature flags for optional dependencies and keep default features minimal.

## Naming and API Consistency
Follow Rust naming conventions strictly: modules/functions/variables in `snake_case`, types/traits/enum variants in `CamelCase`, constants/statics in `SCREAMING_SNAKE_CASE`, and macros as `snake_case!` or clearly descriptive names. Keep naming domain-specific and avoid abbreviations that hide intent.

## Clippy, Formatting, and Documentation
Enforce `cargo fmt` and a strict Clippy baseline in CI (`clippy::all`, optionally selective pedantic lints). Do not enable `clippy::restriction` wholesale. Fix all warnings before shipping. Document public APIs with `///`, module/crate intent with `//!`, and keep documentation examples compiling.

## Unsafe, Security, and Anti-Patterns
Minimize `unsafe` scope and keep unsafe blocks small. Place a `// SAFETY:` comment directly above each unsafe block that states the required invariants. Use `checked_*`, `saturating_*`, or `wrapping_*` arithmetic when overflow is possible (prefer `checked_*` for user-controlled input). Commit `Cargo.lock` for applications (binary crates), but it is acceptable to ignore for libraries. Run `cargo audit` and `cargo deny` in CI and block merges on failures. For cryptography, use vetted crates (`ring`, `rustls`, `argon2`) and never implement primitives yourself. Avoid common anti-patterns: production `.unwrap()`/`.expect()`, unnecessary string cloning, unnecessary `mut`, blocking calls in async contexts, and premature optimization before profiling.
