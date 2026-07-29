---
description: "Implement approved work from a spec or unblocked ticket using its agreed test seams."
agent: Builder
---

$ARGUMENTS

You are running `/implement`. Build the work described by the supplied spec or ticket. This command
executes an agreed scope; it does not reopen product decisions. Before reading a local artifact,
resolve it and confirm it remains within the project root; reject absolute paths and traversal
outside that root. If no usable spec or ticket is provided, ask the user to provide one or run
`/to-spec` first.

## Workflow

1. Read the artifact, its acceptance criteria, blockers, and agreed testing seams. For ticket
   collections, select only an unblocked frontier ticket unless the user explicitly selects one.
2. Follow the Builder mode-selection and pipeline rules. Use test-driven development where the
   agreed seam supports it. Typecheck and run focused tests regularly; run the complete relevant
   suite before completion.
3. Keep implementation within the accepted scope. Return to `/grilling` or `/to-spec` when a
   requirement or architectural decision is missing rather than inventing it during implementation.
4. Request a sidekick review with a feature-scoped session name, run `security-reviewer` when applicable, address
   substantiated findings, and update the ticket's acceptance checklist or configured tracker
   status only after validated completion.
5. Load `git-commit` and commit the completed work to the current branch when the repository and
   user workflow permit it. Report the implemented artifact, validation, review outcome, and commit.
