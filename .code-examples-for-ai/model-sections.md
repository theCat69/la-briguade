<!-- Pattern: model-sections — Parsing and injecting model-specific prompt sections in agent .md files -->

```typescript
// 1. DEFINE KNOWN FAMILIES AND TYPES (src/utils/model-sections.ts)

/** Recognised model-family identifiers for section matching. */
export const KNOWN_FAMILIES = ["claude", "gpt", "gemini", "grok"] as const;

/** Union of recognised model-family names. */
export type ModelFamily = (typeof KNOWN_FAMILIES)[number];

/** Segment target: specific model family or explicit all-model segment. */
export type SectionTarget = ModelFamily | "all";

/** One ordered segment parsed from section headers. */
export type ModelSegment = {
  target: SectionTarget;
  text: string;
};

/** Parsed result of an agent body: base prompt + ordered segments. */
export type ModelSections = {
  base: string;
  segments: ModelSegment[];
};

// Section header regex: ====== FAMILY ====== (4+ equals signs, case-insensitive)
const SECTION_HEADER_RE = /^={4,}\s*(\w+)\s*={4,}\s*$/im;
const MAX_SEGMENTS = 50; // hard cap to prevent runaway parsing

export function parseModelSections(body: string): ModelSections {
  const parts = body.split(SECTION_HEADER_RE);
  if (parts.length === 1) return { base: body.trim(), segments: [] };

  // split with a capturing group yields: [before, cap1, text1, cap2, text2, ...]
  const base = (parts[0] ?? "").trim();
  const segments: ModelSegment[] = [];

  for (let i = 1; i + 1 < parts.length; i += 2) {
    if (segments.length >= MAX_SEGMENTS) {
      logger.warn(`model section count exceeded MAX_SEGMENTS=${MAX_SEGMENTS}; remaining sections skipped`);
      break;
    }
    const target = (parts[i] ?? "").toLowerCase();
    const isKnownFamily = (KNOWN_FAMILIES as readonly string[]).includes(target);
    if (!isKnownFamily && target !== "all") {
      logger.warn(`unknown model section family: '${target}' in agent body — skipped`);
      continue;
    }
    segments.push({
      target: target as SectionTarget,
      text: (parts[i + 1] ?? "").trim(),
    });
  }

  return { base, segments };
}

// 2. AgentSectionsEntry TYPE (src/hooks/index.ts)
// Holds both the base prompt and ordered segments for one agent.

export type AgentSectionsEntry = {
  base: string;
  segments: ModelSegment[];
};

// 3. POPULATE THE SEGMENTS MAP IN registerAgents (src/plugin/agents.ts)
// After parseFrontmatter(), call parseModelSections() to split base from segments.
// Store entry keyed by AGENT NAME (e.g. "coder", "reviewer") — not by base text.

const { base, segments } = parseModelSections(body);
agentConfig.prompt = base;                    // register base-only prompt
if (segments.length > 0) {
  agentSections.set(agentName, { base, segments });  // Map<string, AgentSectionsEntry>
}

// Return type of registerAgents — callers receive the populated map.
export type RegisterAgentsResult = {
  agentSections: Map<string, AgentSectionsEntry>;
};

// 4. RESOLVE ORDERED SEGMENTS FOR A MODEL (src/utils/model-sections.ts)
// Include segments in document order when target is "all" or matched family.
// Claude fallback is only used for legacy files that have NO "all" segment.

export function resolveModelSection(
  segments: ModelSegment[],
  modelId: string,
): string | undefined {
  const normalizedId = modelId.toLowerCase();
  const matchedFamily = KNOWN_FAMILIES.find((f) => normalizedId.includes(f));

  const resolved = segments
    .filter((s) => s.target === "all" || s.target === matchedFamily)
    .map((s) => s.text.trim())
    .filter((text) => text.length > 0)
    .join("\n\n");

  if (resolved.length > 0) return resolved;

  // Suppress claude fallback if: family was recognised OR any "all" segment exists.
  // Only fall back when the model is fully unknown AND no "all" segment is present.
  const hasAll = segments.some((s) => s.target === "all");
  if (matchedFamily !== undefined || hasAll) return undefined;

  const claude = segments.find((s) => s.target === "claude")?.text.trim();
  return claude && claude.length > 0 ? claude : undefined;
}

// 4. INJECT AT RUNTIME VIA HOOK (src/hooks/index.ts)
// createHooks() accepts both agentSections and vendorPrompts maps.

export function createHooks(
  ctx: PluginInput,
  agentSections: ReadonlyMap<string, AgentSectionsEntry>,
  vendorPrompts: ReadonlyMap<string, string>,
): Partial<HooksResult> {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      const modelId = input.model?.id?.toLowerCase() ?? "";
      for (const [_agentName, entry] of agentSections) {
        // Match system prompt string against stored base (trimmed comparison)
        const idx = output.system.findIndex((s) => s.trim() === entry.base.trim());
        if (idx === -1) continue;

        const match = resolveModelSection(entry.segments, modelId);
        if (match === undefined) continue;

        const current = output.system[idx];
        if (current !== undefined) {
          output.system[idx] = current + "\n\n" + match;  // APPEND — base always kept
        }
      }
    },
  };
}

// 5. Example input with interleaved ALL + family sections

const body = [
  "Base prompt.",
  "",
  "====== CLAUDE ======",
  "Claude-1",
  "",
  "====== GPT ======",
  "GPT-1",
  "",
  "====== ALL ======",
  "Shared-1",
  "",
  "====== GPT ======",
  "GPT-2",
].join("\n");

const parsed = parseModelSections(body);
// parsed.segments = [
//   { target: "claude", text: "Claude-1" },
//   { target: "gpt", text: "GPT-1" },
//   { target: "all", text: "Shared-1" },
//   { target: "gpt", text: "GPT-2" },
// ]

resolveModelSection(parsed.segments, "anthropic/claude-3-7-sonnet");
// "Claude-1\n\nShared-1"

resolveModelSection(parsed.segments, "openai/gpt-4o");
// "GPT-1\n\nShared-1\n\nGPT-2"

resolveModelSection(parsed.segments, "google/gemini-pro");
// "Shared-1"

// 6. WIRE IN index.ts — shared map populated in config(), read by hooks

const agentSections: Map<string, AgentSectionsEntry> = new Map();
const vendorPrompts = loadVendorPrompts([builtinVendorDir, ...userVendorDirs]);
config: async (input) => {
  const { agentSections: sections } = registerAgents(input, contentDir, userConfig);
  for (const [key, value] of sections) agentSections.set(key, value);
},
...createHooks(ctx, agentSections, vendorPrompts),
```
