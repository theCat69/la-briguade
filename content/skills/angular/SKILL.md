---
name: angular
description: Angular-specific coding guidelines — standalone components, OnPush, signals, reactive forms, and testing conventions
---

# Angular Skill

## Standalone Components by Default
All new components, directives, and pipes must be standalone (`standalone: true`). Do not create NgModules for new features. Standalone components are the Angular default since Angular 19 and simplify dependency management.

## OnPush Change Detection on Every Component
Every component must declare `changeDetection: ChangeDetectionStrategy.OnPush`. This is not the Angular framework default but is the required practice here. OnPush eliminates unnecessary re-renders and is essential for performance at scale. Use signals or explicit `markForCheck()` to trigger updates when needed.

## Signals for Local State
Use Angular signals (`signal()`, `computed()`, `effect()`) for all component-local state. Signals integrate with OnPush change detection automatically — updating a signal triggers the component's change detection without manual intervention. Reserve RxJS observables for genuinely asynchronous streams (HTTP, WebSockets, timer-based logic).

## RxJS Streams with takeUntilDestroyed
When using RxJS inside components, always complete subscriptions using `takeUntilDestroyed()` from `@angular/core/rxjs-interop`. This operator ties the observable lifecycle to the component's destroy lifecycle without requiring manual `ngOnDestroy` cleanup.

## inject() Over Constructor Injection
Use the `inject()` function for dependency injection instead of constructor parameter injection. `inject()` works in standalone components, guards, resolvers, and functional code. It produces cleaner, more composable code than constructor injection.

## Async Pipe Over Manual Subscriptions
In templates, always use the `async` pipe to subscribe to observables. Never subscribe manually inside a component and assign the result to a property — this creates subscription lifecycle management overhead and defeats OnPush.

## Smart and Dumb Component Split
Separate components into smart (container) components that own state and interact with services, and dumb (presentational) components that receive data via `@Input()` and emit events via `@Output()`. Dumb components must be pure: given the same inputs, they always render the same output.

## Lazy-Loaded Routes Always
All feature modules and pages must be lazy-loaded via `loadComponent()` or `loadChildren()` in the route configuration. Eager loading of feature routes is not acceptable in a production application.

## Reactive Forms for Non-Trivial Forms
Use reactive forms (`FormBuilder`, `FormGroup`, `FormControl`) for any form with more than two fields, conditional validation, or dynamic controls. Template-driven forms are acceptable only for simple, single-field inputs.

## Track in @for Always
Every `@for` block in a template must include a `track` expression. Omitting `track` forces Angular to re-render the entire list on every change detection cycle.

## Signal-Based Store First
Use a lightweight signal-based store for shared state before reaching for NgRx. Introduce NgRx (or a comparable state management library) only when cross-feature state synchronization, time-travel debugging, or side-effect orchestration complexity justifies the overhead.

## Naming Conventions
- Components: `feature.component.ts`
- Services: `feature.service.ts`
- Stores: `feature.store.ts`
- Route configuration: `feature.routes.ts`
- Types and interfaces: `feature.model.ts`

## Testing
- Use `@testing-library/angular` for component tests — test behavior, not implementation details.
- Use `HttpClientTestingModule` for HTTP integration tests.
- Use `TestBed.overrideProvider()` to inject mocks without modifying production providers.
- Use Cypress or Playwright for end-to-end tests against a running application.