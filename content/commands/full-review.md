---
description: Run a full DEEP FULL REVIEW of the project — code quality, security, and documentation
---

You are executing a comprehensive full-project review. Follow every step in order. Do NOT skip steps.

> **DEEP FULL REVIEW mode is ACTIVE.** All sub-agents called in this workflow must receive the phrase "DEEP FULL REVIEW" in their prompt. This disables `git-diff-review` skill loading in reviewer, security-reviewer, and librarian — they will scan the entire codebase instead of restricting to changed files.

---

## Step 1 — Full Local Context Scan (MANDATORY)

Call the `local-context-gatherer` sub-agent with this prompt:

> **DEEP FULL REVIEW** — Perform a comprehensive full project scan. Return a structured summary including:
> - Tech stack (languages, frameworks, runtime versions)
> - Full directory structure (top-level + 2 levels deep)
> - All source directories, test directories, config files, documentation files
> - Key dependencies from all manifest files
> - Existing conventions and coding patterns (sample 3–5 source files)
> - Any security-sensitive files (env files, secret configs, auth code)
> - All documentation files (README.md, AGENTS.md, CLAUDE.md, /docs, .opencode/skills/, .code-examples-for-ai/)
>
> Cache results to `.ai/local-context-gatherer_cache/context.json`.

Wait for the response before continuing.

---

## Step 2 — Full Code Quality Review (MANDATORY)

Call the `reviewer` sub-agent with this prompt:

> **DEEP FULL REVIEW** — Review the ENTIRE codebase for code quality, maintainability, and correctness. Do NOT load git-diff-review. Do NOT restrict scope to changed files.
>
> **Scope**: All source files in the project.
>
> Focus areas:
> - Correctness issues (logic errors, edge cases, null handling)
> - Maintainability (complexity, naming, duplication, dead code)
> - Performance anti-patterns
> - Architecture violations (coupling, SRP violations, missing abstractions)
> - Style violations against `.opencode/skills/project-coding` (if present)
>
> Use `local-context-gatherer` to understand project structure and conventions.
> Use `external-context-gatherer` if needed for framework-specific best practices.
>
> Return all findings with: file path, line range (if applicable), severity (Critical / High / Medium / Low), category, and a brief explanation.

Wait for the response before continuing.

---

## Step 3 — Full Security Review (MANDATORY)

Call the `security-reviewer` sub-agent with this prompt:

> **DEEP FULL REVIEW** — Review the ENTIRE codebase for security vulnerabilities. Do NOT load git-diff-review. Do NOT restrict scope to changed files.
>
> **Scope**: All source files, configuration files, and dependency manifests.
>
> Focus areas:
> - OWASP Top 10 vulnerabilities in source code
> - Hardcoded secrets, API keys, or passwords in source or config files
> - Insecure dependencies (check CVEs via GitHub Advisory Database for all packages)
> - Authentication and authorization flaws
> - Input validation and injection vulnerabilities
> - Insecure cryptographic patterns
>
> Use `local-context-gatherer` to discover all relevant files.
> Check all dependency manifests for CVEs.
> Run `git remote -v` and check Dependabot alerts if the project is on GitHub.
>
> Return all findings with: file path, line range (if applicable), severity (Critical / High / Medium / Low), CVE ID (if applicable), and mitigation.

Wait for the response before continuing.

---

## Step 4 — Full Documentation Review (MANDATORY)

Call the `librarian` sub-agent with this prompt:

> **DEEP FULL REVIEW** — Audit the ENTIRE project documentation for completeness, accuracy, and consistency with the codebase. Do NOT load git-diff-review. Do NOT restrict scope to recently changed files.
>
> **Scope**: All documentation files — README.md, AGENTS.md, CLAUDE.md, /docs, .opencode/skills/, .code-examples-for-ai/, and any other markdown files.
>
> Focus areas:
> - Missing or outdated documentation for existing features
> - README completeness (setup, install, usage, contributing)
> - API documentation accuracy
> - Inconsistencies between code and docs
> - Missing documentation for public APIs or important modules
>
> Use `local-context-gatherer` to understand project structure and compare what exists vs what is documented.
>
> Return all findings with: file path (if applicable), severity (Critical / High / Medium / Low), category, and what needs to be added or updated.

Wait for the response before continuing.

---

## Step 5 — Consolidate and Analyze Findings

Collect all findings from Steps 2, 3, and 4. For each finding, reason carefully about its validity:

1. **Assess false-positive likelihood**:
   - Is the finding based on a misunderstanding of the project's intentional design?
   - Is it flagging an intentional permission grant, configuration, or pattern?
   - Is it a generic warning that does not apply to this specific context?
   - Is the evidence conflicting or ambiguous?

2. **Classify each finding into one of three categories**:
   - **Confirmed** — Clear, actionable issue with strong evidence it applies.
   - **Uncertain** — Possibly a false positive; needs user clarification before acting.
   - **Discarded** — Confidently a false positive given project context (explain why).

3. Build three lists:
   - **Confirmed findings** grouped by severity: Critical → High → Medium → Low
   - **Uncertain findings** with a brief explanation of the ambiguity
   - **Discarded findings** with brief reasoning (for transparency)

---

## Step 6 — Present Results to the User

Present a clear, structured summary using the `question` tool. Use this format:

```
## Full Project Review Results

### ✅ Confirmed Issues

**Critical (N)**
- [finding summary — file:line — category]

**High (N)**
- ...

**Medium (N)**
- ...

**Low (N)**
- ...

---

### ⚠️ Uncertain (possible false positives) (N)
- [finding summary — reason for uncertainty]

---

### 🗑️ Discarded (false positives) (N)
- [finding summary — reason discarded]
```

---

## Step 7 — Ask the User for Next Action

Use the `question` tool to ask the user what they want to do:

> **What would you like to do with these findings?**
>
> - **Implement fixes now** — Start resolving confirmed issues immediately (Critical and High priority first).
> - **Write specs/tasks** — Create a structured task file (e.g. `tasks/full-review-fixes.md`) listing all confirmed findings with proposed fixes and acceptance criteria, for future implementation.
> - **Both** — Write the specs/task file first, then begin implementing.
> - **Review uncertain findings** — Walk through each uncertain finding together before deciding.

Based on the user's choice:

- **Implement fixes now**: Follow the standard implementer workflow — call `coder` for each fix, then call `reviewer` and `security-reviewer` to validate each change before moving to the next.
- **Write specs/tasks**: Call `coder` to write a structured markdown task file with all confirmed findings, their context, proposed mitigations, and acceptance criteria.
- **Both**: Write the task file first, then start implementing.
- **Review uncertain findings**: Present each uncertain finding one by one using `question` tool and ask the user to confirm, dismiss, or flag for later.