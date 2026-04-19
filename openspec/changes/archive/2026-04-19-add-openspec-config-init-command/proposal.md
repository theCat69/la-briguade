## Why

Users working in this repository have OpenSpec-aware planning and implementation commands, but no guided way to initialize repository-local OpenSpec configuration correctly. Adding a dedicated init command reduces setup errors, aligns this workflow with current upstream OpenSpec conventions (`openspec/config.yaml`), and avoids perpetuating outdated local paths.

## What Changes

- Add a new OpenSpec-aware slash command that initializes repository-local OpenSpec configuration for the user’s current working repository.
- Establish that the command should align with upstream OpenSpec initialization behavior, treating `openspec/config.yaml` as the owned config path rather than older `@openspec/config.yaml` conventions.
- Require idempotent behavior so repeated use supports safe setup checks and extension without damaging an existing valid repository configuration.
- Define repair/override expectations to remain consistent with upstream `openspec init` semantics, including explicit force-style recovery behavior when local config is missing, stale, or corrupted.
- Update repository workflow guidance so OpenSpec setup is an explicit, discoverable prerequisite for plan/implement flows.

## Capabilities

### New Capabilities
- `openspec-config-init-command`: A slash command that safely initializes and verifies repository-local OpenSpec configuration using current upstream conventions.

### Modified Capabilities
- None.

## Impact

- **Affected code/content:** repository command content under `content/commands/`, related workflow guidance in agent/docs content, and new OpenSpec capability artifacts under `specs/openspec-config-init-command/`.
- **Affected systems:** local repository setup flow for OpenSpec-driven planning and implementation.
- **APIs/dependencies:** no new external dependency is required by this proposal; behavior should align with existing upstream OpenSpec CLI conventions and current config path ownership.
- **Operational impact:** reduces onboarding friction, prevents config drift toward outdated paths, and improves safety by making initialization idempotent and repairable instead of ad hoc.
