---
name: java
description: Java-specific coding guidelines — records, sealed classes, Optional, virtual threads, and stream-based data handling
detect:
  files:
    - pom.xml
    - build.gradle
    - build.gradle.kts
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

# Java Skill

## Records for Immutable DTOs
Use Java records for all data transfer objects, value objects, and immutable data carriers. Records automatically provide canonical constructors, `equals`, `hashCode`, and `toString`. Do not use plain classes with manual getters for immutable data.

## Sealed Classes and Pattern Matching
Use sealed classes combined with pattern matching (`switch` expressions with type patterns) to model algebraic data types (ADTs) and exhaustive state variants. The compiler enforces exhaustiveness when all permitted subtypes are covered.

## Var for Local Variables
Use `var` for local variable declarations where the type is obvious from the right-hand side. Do not use `var` for fields, parameters, or return types. Do not use `var` when the inferred type would be non-obvious to a reader.

## Optional for Absent Values
Use `Optional<T>` as a return type when a method may legitimately return no value. Never use `Optional` as a field type, constructor parameter, or method parameter — it is a return-type convention only. Never return `null` from a public API method.

## Immutable Collections by Default
Create collections with `List.of()`, `Set.of()`, and `Map.of()` unless mutability is explicitly required. When a mutable collection is needed, document why. Never expose mutable collections from public APIs.

## Streams Over Imperative Loops
Prefer the Stream API for data transformation, filtering, and aggregation over imperative `for`/`while` loops. Use method references where they improve readability. Avoid stateful lambdas in stream pipelines.

## Exception Strategy
Use unchecked exceptions (subclasses of `RuntimeException`) for unrecoverable programming errors and infrastructure failures. Use checked exceptions only when the caller is expected to handle the failure as a normal part of the control flow. Never swallow exceptions silently.

## Virtual Threads for I/O Concurrency
Use virtual threads (via `Thread.ofVirtual()` or a virtual-thread executor) for I/O-bound concurrency in Java 21+. Virtual threads are cheap enough to create one per request. Use `ScopedValue` for passing contextual data across virtual thread boundaries instead of `ThreadLocal`.

## Text Blocks and Formatted Strings
Use text blocks for multi-line string literals (SQL, JSON templates, HTML snippets). Use `String.formatted()` instead of `String.format()` for inline formatting — it is an instance method and reads more naturally in method chains.
