---
name: project-documentation
description: Documentation standards for code, README, API docs, and changelog for la-briguade
---

## Code Documentation

- Use **TSDoc** for all exported functions and types:
  ```typescript
  /**
   * Parse YAML frontmatter from a markdown string.
   *
   * @param content - Raw markdown file content
   * @returns Parsed frontmatter attributes and remaining body
   */
  export function parseFrontmatter(content: string): ParsedFrontmatter { ... }
  ```
- TSDoc tags to use: `@param`, `@returns`, `@throws`, `@example`, `@remarks`
- **Inline comments**: only for non-obvious *why* decisions — workarounds, invariants, business rules
  - Good: `// Skip the opening "---" line` / `// Invariant: HEAD_SIZE + TAIL_SIZE ≤ TRUNCATION_THRESHOLD`
  - Bad: `// increment i` / `// return result`
- Document **all exported symbols** from `src/index.ts` and any module re-exporting them
- Internal helpers: document only if their behavior is surprising or non-obvious
- Do NOT leave commented-out code in any committed file

## README Format

Sections in this order (keep consistent with existing `README.md`):

1. **Description** — one-line summary + brief paragraph
2. **Installation** — `npm install la-briguade` + `npx la-briguade install`
3. **Usage** — how the plugin integrates with opencode
4. **Agents** table — name, type (primary/subagent), purpose
5. **Skills** table — name, purpose
6. **Commands** table — slash command, purpose
7. **Hooks** — list hooks and what they do
8. **CLI** — `install`, `uninstall`, `doctor` commands
9. **Custom Content** — how to add custom agents/skills/commands
10. **Requirements** — Node ≥22, peer dependency

> Keep README accurate with every release. The README is the primary consumer-facing documentation.

## API Documentation

- `src/index.ts` exports the default `Plugin` — document it with a full TSDoc block including `@example`
- Content `.md` files (`content/agents/*.md`, `content/skills/*/SKILL.md`, `content/commands/*.md`) serve as their own "API documentation" via their YAML frontmatter
- Frontmatter field documentation lives as comments in the relevant `register*.ts` source file
- No dedicated API doc site needed at current scale

## Changelog

- Follow **Keep a Changelog** format: https://keepachangelog.com/
- File: `CHANGELOG.md` at repo root
- Structure:
  ```markdown
  ## [Unreleased]
  ### Added
  ### Changed
  ### Fixed

  ## [0.1.0] - 2026-01-01
  ### Added
  - Initial release...
  ```
- Categories: **Added**, **Changed**, **Fixed**, **Removed**, **Security**, **Deprecated**
- Create before the first public `npm publish`

## Content File Documentation

Each agent `.md` file in `content/agents/` should:
- Have frontmatter with at minimum: `name`, `description`, `type` (`primary` | `subagent`)
- Have a body describing the agent's identity, mission, and key capabilities
- Keep the body concise — it is injected into the model system prompt at runtime

Each skill `SKILL.md` file should:
- Have frontmatter with exactly `name` and `description`
- Open with a one-paragraph summary of what the skill covers
- Use `##` sections for major topic areas
- Keep content actionable — the AI reads this at task time, not for background reading
