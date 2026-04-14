<!-- Pattern: agent-permissions — Agent visibility controlled only by permission allow/ask/deny with permission.skill gating -->

### Agent frontmatter (`content/agents/coder.md`)

```yaml
---
description: Production coding agent
model: openai/gpt-4o
permission:
  read: "allow"
  edit: "ask"
  bash: "deny"
  skill:
    "*": "deny"
    "typescript": "allow"
    "general-coding": "allow"
---

You are the coder agent...
```

### Permission behavior

```typescript
// Visibility is permission-driven:
// - "allow" or "ask": tool/MCP/skill is available to the agent
// - "deny": hidden from the agent

const permission = {
  read: "allow",
  edit: "ask",
  bash: "deny",
} as const;

const canSeeRead = permission.read === "allow" || permission.read === "ask"; // true
const canSeeEdit = permission.edit === "allow" || permission.edit === "ask"; // true
const canSeeBash = permission.bash === "allow" || permission.bash === "ask"; // false
```

### `permission.skill` gating pattern

```typescript
// agents.ts extracts permission.skill into:
// agentSkillPerms: Map<agentName, Record<skillName, "allow" | "ask" | "deny">>
//
// With { "*": "deny" }, only explicitly allowed/asked skills pass.
// Omitting permission.skill means no skill-level gating.

function gateSkillAccess(agentName: string, requestedSkill: string): boolean {
  const perms = agentSkillPerms.get(agentName);
  if (perms === undefined) return true;
  if (perms["*"] !== "deny") return true;
  return perms[requestedSkill] === "allow" || perms[requestedSkill] === "ask";
}
```

### Complementary skill-side `agents:` opt-in pattern

```yaml
---
name: playwright-cli
description: Browser automation tooling
agents: [coder, reviewer]
---
```

When a skill declares `agents:` like this, listed agents are auto-opted into that skill at
startup. Those agents no longer need explicit `permission.skill` entries for that specific
skill in their own frontmatter.
