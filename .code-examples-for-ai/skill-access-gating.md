<!-- Pattern: skill-access-gating — Gate skill tool calls by agent permission.skill with session->agent tracking -->

```typescript
// src/hooks/index.ts — keep transient session->agent mapping in createHooks() closure.
// Key points:
//   1. Capture agent identity from "chat.params" (has { sessionID, agent })
//   2. Enforce policy in "tool.execute.before" (skill calls only)
//   3. Lockdown only when permission.skill["*"] === "deny" (default allow otherwise)
//   4. Fail open when session/agent permissions are unknown
//   5. Remove mapping on session.deleted via event.properties.info.id

const sessionAgentMap = new Map<string, string>();

"chat.params": async (input) => {
  sessionAgentMap.set(input.sessionID, input.agent);
},

"tool.execute.before": async (input, output) => {
  if (input.tool !== "skill") return;

  const agentName = sessionAgentMap.get(input.sessionID);
  if (agentName === undefined) return; // fail open

  const perms = agentSkillPerms.get(agentName);
  if (perms === undefined || perms["*"] !== "deny") return;

  const requested = isRecord(output.args) && typeof output.args.name === "string"
    ? output.args.name
    : "";

  const allowed = perms[requested] === "allow" || perms[requested] === "ask";
  if (!allowed) {
    output.args = { ...(isRecord(output.args) ? output.args : {}), name: "" };
  }
},

event: async ({ event }) => {
  if (event.type !== "session.deleted") return;
  const sessionID = isRecord(event.properties) && isRecord(event.properties.info)
    ? event.properties.info.id
    : undefined;

  if (typeof sessionID === "string") {
    sessionAgentMap.delete(sessionID);
  }
},
```
