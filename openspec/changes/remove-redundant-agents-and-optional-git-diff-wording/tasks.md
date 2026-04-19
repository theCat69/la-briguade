## 1. Update init-implementer auto-inject output guidance

- [ ] 1.1 Remove generated `agents:` block instructions from `content/commands/init-implementer.md` auto-inject skill output guidance.
- [ ] 1.2 Add explicit wording that activation relies on existing agent-side `permission.skill` / project configuration opt-in, with no replacement generated activation step.
- [ ] 1.3 Verify updated command wording still provides a complete, implementation-usable auto-inject `SKILL.md` output contract.

## 2. Make git-diff loading conditional in reviewer-family prompts

- [ ] 2.1 Update `content/agents/reviewer.md` to make git-diff skill loading optional when invoking prompt already includes sufficient diff context.
- [ ] 2.2 Update `content/agents/security-reviewer.md` with the same conditional git-diff wording.
- [ ] 2.3 Update `content/agents/librarian.md` with the same conditional git-diff wording.
- [ ] 2.4 Ensure all three agent prompts preserve explicit fallback guidance to load git-diff when diff context is absent.

## 3. Validate OpenSpec artifact readiness

- [ ] 3.1 Run `openspec validate remove-redundant-agents-and-optional-git-diff-wording` and resolve any artifact-level issues.
- [ ] 3.2 Run `openspec status --change "remove-redundant-agents-and-optional-git-diff-wording"` to confirm apply readiness.
