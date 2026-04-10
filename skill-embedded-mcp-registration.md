skill-embedded-mcp-registration.md
# Idea: Skill-Embedded MCP Server Registration
## What
Allow a skill's `SKILL.md` frontmatter to declare an MCP server that gets
automatically registered alongside the skill itself. The MCP would be wired
into opencode's config the same way skills are — purely through content-driven
registration, no extra config required from the user.
## Why it matters
Right now a skill is only a prompt document. It can describe how to use a tool,
but it cannot *bring* that tool with it. The `playwright-cli` skill is the
clearest example: it ships detailed reference files for Playwright automation,
yet the actual Playwright MCP server that makes those references useful has to
be set up separately by the user.
Coupling a skill to its MCP would make skills self-contained units — install
the skill, get the tool. This mirrors oh-my-openagent's approach and would be a
significant DX improvement for skills that are only meaningful alongside a
specific toolset.
## Surface area
- `content/skills/` — where frontmatter declarations would live
- `src/plugin/skills.ts` — the registration logic (currently only registers paths)
- `src/index.ts` / the `config()` callback — where MCP entries would need to be
  injected into `input`
## Open questions
- Should MCP declarations be optional per-skill, or allowed on any skill?
- How to handle conflicts if two skills declare the same MCP server?
- Should the frontmatter support both local (`command`/`args`) and remote (`url`)
  MCP types, matching opencode's own schema?
- Does the user need a way to opt out of a skill's MCP without removing the skill?
