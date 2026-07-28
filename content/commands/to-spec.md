---
description: "Turn the current conversation into a spec and publish it to the configured tracker or local Markdown."
---

$ARGUMENTS

You are running `/to-spec`. Synthesize the current conversation and repository understanding into
a durable specification. Do not restart requirements discovery: if the discussion is not settled,
direct the user to `/grilling` before continuing.

## Process

1. Read the project guidance, domain vocabulary, relevant ADRs, and code area when they have not
   already been established in this session. Use the project's language throughout.
2. Identify the smallest stable seams at which the change will be tested. Prefer existing seams and
   the highest-level observable behavior. Present the proposed seams and wait for user confirmation.
3. Write the specification with these sections:
   - `## Problem Statement`
   - `## Solution`
   - `## User Stories` — extensive numbered, independently checkable stories
   - `## Implementation Decisions` — settled architecture, contracts, and constraints; avoid file
     paths and implementation snippets unless a prototype precisely captures a decision
   - `## Testing Decisions` — agreed seams, behavioral expectations, and relevant prior art
   - `## Out of Scope`
   - `## Further Notes`
4. Derive `<feature-slug>` from the agreed feature title using lowercase letters, numbers, and
   hyphens only. Resolve every local artifact path and confirm it remains within
   `<project-root>/.scratch/` before writing.
5. The command configuration resolves to: `{{TRACKER_CONFIGURATION}}` When it identifies a host
   tracker integration, publish one tracker issue with the `ready-for-agent` label. Otherwise write
   `.scratch/<feature-slug>/spec.md`, creating only that project-local directory.
6. Report the artifact location and recommend `/to-tickets` for approved implementation slicing.

Do not implement code, create tickets, or ask a new requirements interview in this command.
