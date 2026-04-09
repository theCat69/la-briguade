<!-- Pattern: model-sections — Parsing and injecting model-specific prompt sections in agent .md files -->

```typescript
// 1. DEFINE KNOWN FAMILIES AND TYPES (src/utils/model-sections.ts)

/** Recognised model-family identifiers for section matching. */
export const KNOWN_FAMILIES = ["claude", "gpt", "gemini", "grok"] as const;

/** Union of recognised model-family names. */
export type ModelFamily = (typeof KNOWN_FAMILIES)[number];

/** Parsed result of an agent body: base prompt + per-family section map. */
export type ModelSections = {
  base: string;
  sections: Partial<Record<ModelFamily, string>>;
};

// Section header regex: ====== FAMILY ====== (4+ equals signs, case-insensitive)
const SECTION_HEADER_RE = /^={4,}\s*(\w+)\s*={4,}\s*$/im;

export function parseModelSections(body: string): ModelSections {
  const parts = body.split(SECTION_HEADER_RE);
  if (parts.length === 1) return { base: body.trim(), sections: {} };

  // split with a capturing group yields: [before, cap1, text1, cap2, text2, ...]
  const base = (parts[0] ?? "").trim();
  const sections: Partial<Record<ModelFamily, string>> = {};

  for (let i = 1; i + 1 < parts.length; i += 2) {
    const family = (parts[i] ?? "").toLowerCase();
    if (!(KNOWN_FAMILIES as readonly string[]).includes(family)) {
      console.warn(`[la-briguade] unknown model section family: '${family}' in agent body — skipped`);
      continue;
    }
    sections[family as ModelFamily] = (parts[i + 1] ?? "").trim();
  }

  return { base, sections };
}

// 2. AgentSectionsEntry TYPE (src/hooks/index.ts)
// Holds both the base prompt and the per-family sections for one agent.

export type AgentSectionsEntry = {
  base: string;
  sections: Partial<Record<ModelFamily, string>>;
};

// 3. POPULATE THE SECTIONS MAP IN registerAgents (src/plugin/agents.ts)
// After parseFrontmatter(), call parseModelSections() to split base from sections.
// Store entry keyed by AGENT NAME (e.g. "coder", "reviewer") — not by base text.

const { base, sections } = parseModelSections(body);
agentConfig.prompt = base;                    // register base-only prompt
if (Object.keys(sections).length > 0) {
  agentSections.set(agentName, { base, sections });  // Map<string, AgentSectionsEntry>
}

// Return type of registerAgents — callers receive the populated map.
export type RegisterAgentsResult = {
  agentSections: Map<string, AgentSectionsEntry>;
};

// 4. INJECT AT RUNTIME VIA HOOK (src/hooks/index.ts)
// createHooks() accepts agentSections; the transform handler iterates it.

export function createHooks(
  _ctx: PluginInput,
  agentSections: Map<string, AgentSectionsEntry>,
): Partial<HooksResult> {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      const modelId = input.model?.id?.toLowerCase() ?? "";
      for (const [_agentName, entry] of agentSections) {
        // Match system prompt string against stored base (trimmed comparison)
        const idx = output.system.findIndex((s) => s.trim() === entry.base.trim());
        if (idx === -1) continue;

        const match = resolveModelSection(entry.sections, modelId);
        if (match === undefined) continue;

        const current = output.system[idx];
        if (current !== undefined) {
          output.system[idx] = current + "\n\n" + match;  // APPEND — base always kept
        }
      }
    },
  };
}

// 5. WIRE IN index.ts — shared Map populated in config(), read by the hook

const agentSections: Map<string, AgentSectionsEntry> = new Map();
config: async (input) => {
  const { agentSections: sections } = registerAgents(input, contentDir, userConfig);
  for (const [key, value] of sections) agentSections.set(key, value);
},
...createHooks(ctx, agentSections),
```
