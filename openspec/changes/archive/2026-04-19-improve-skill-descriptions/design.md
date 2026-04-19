## Context

This change is documentation-focused but cross-cutting: it spans core skills, auto-inject skills, and the project code-example index. The main problem is ambiguity in description text, especially when skill descriptions are used in injected prompt wrappers.

## Goals / Non-Goals

**Goals:**
- Define what makes a skill description precise and usable.
- Codify optional auto-inject description-line behavior in a testable way.
- Keep code-example coverage aligned when description patterns change.

**Non-Goals:**
- No runtime behavior changes to loaders, hooks, or injection code.
- No new CLI commands or plugin configuration changes.

## Decisions

1. **Capability split by concern**  
   Use separate capabilities for skill-description quality, auto-inject description-line contract, and code-example index alignment.  
   **Rationale:** Keeps requirements small, verifiable, and independently maintainable.

2. **Behavioral language over style language**  
   Requirements define observable outcomes (what descriptions must convey and when lines appear), not prose style preferences.  
   **Rationale:** Reduces subjective interpretation during apply.

3. **Apply-readiness via completed checklist**  
   `tasks.md` is provided with fully checked, concrete validation items for proposal/spec/design consistency.  
   **Rationale:** Matches this change's apply requirement (`tasks`) without implementation code edits.

## Risks / Trade-offs

- Overly strict wording can make future skill authoring slower.
- Too-loose wording would fail to solve the original ambiguity problem.

## Open Questions

- Should future changes add linting/validation for description precision, or keep enforcement documentation-only?
