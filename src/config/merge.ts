import type { AgentConfig } from "@opencode-ai/sdk";

import type { AgentOverride, LaBriguadeConfig } from "./schema.js";
import { isRecord } from "../utils/support/type-guards.js";

/**
 * Swap a `claude-opus-*` model string to the equivalent `claude-sonnet-*`.
 *
 * Pure function — no side effects. Applied when `opus_enabled` is false (the
 * default) so that agents do not inadvertently use expensive opus models.
 *
 * Examples:
 *   `github-copilot/claude-opus-4.6` → `github-copilot/claude-sonnet-4.6`
 *   `github-copilot/claude-sonnet-4.6` → unchanged (not an opus model)
 */
export function swapOpusModel(model: string): string {
  return model.replace(/claude-opus-(\d\S*)/, "claude-sonnet-$1");
}

/**
 * Apply an AgentOverride on top of a base AgentConfig.
 *
 * Returns a new object — the base is never mutated.
 * systemPromptSuffix is appended to base.prompt (the SDK field for system prompt)
 * with a "\n\n" separator. If the base has no prompt, the suffix becomes the prompt.
 */
export function applyAgentOverride(base: AgentConfig, override: AgentOverride): AgentConfig {
  // Build the merged prompt from base + suffix
  let prompt: string | undefined = base.prompt;
  if (override.systemPromptSuffix !== undefined) {
    prompt =
      prompt !== undefined && prompt !== ""
        ? `${prompt}\n\n${override.systemPromptSuffix}`
        : override.systemPromptSuffix;
  }

  // Start with a shallow copy of the base to avoid mutation
  const merged: AgentConfig = { ...base };

  // Apply optional overrides — only set when a value is present to satisfy
  // exactOptionalPropertyTypes (present field must not be undefined)
  if (override.model !== undefined) {
    merged["model"] = override.model;
  }

  if (override.temperature !== undefined) {
    merged["temperature"] = override.temperature;
  }

  // SDK uses top_p (snake_case) — map from override's camelCase topP
  if (override.topP !== undefined) {
    merged["top_p"] = override.topP;
  }

  // Store fields accepted by AgentConfig's index signature [key: string]: unknown
  if (override.topK !== undefined) {
    merged["topK"] = override.topK;
  }
  if (override.variant !== undefined) {
    merged.variant = override.variant;
  }
  if (override.maxTokens !== undefined) {
    merged["maxTokens"] = override.maxTokens;
  }

  // Update prompt (may be undefined if neither base nor override has content)
  if (prompt !== undefined) {
    merged["prompt"] = prompt;
  }

  // Deep-merge permission: base permission spread then override permission spread.
  // Cast via unknown is intentional: AgentConfig.permission has a specific SDK type,
  // but override.permission is Record<string, unknown>. The merged result satisfies
  // the index signature and real permission fields are subset of Record<string, unknown>.
  // We use the index signature path (string key) to bypass exactOptionalPropertyTypes
  // strictness when assigning back the merged permission object.
  if (override.permission !== undefined) {
    const basePermission = isRecord(base.permission) ? base.permission : {};
    const mergedPermission = {
      ...basePermission,
      ...override.permission,
    };
    merged["permission"] = mergedPermission;
  }

  return merged;
}

/**
 * Resolve the final AgentConfig for a given agent by applying user overrides
 * on top of the base (frontmatter-derived) config.
 *
 * Merge order (lowest to highest priority):
 *   1. base (frontmatter defaults)
 *   2. global model default (top-level userConfig.model, only if no per-agent model)
 *   3. per-agent override (userConfig.agents[agentId])
 */
export function resolveAgentConfig(
  agentId: string,
  base: AgentConfig,
  userConfig: LaBriguadeConfig,
): AgentConfig {
  const agentOverride = userConfig.agents?.[agentId];

  // Apply global model default only when:
  //   - a top-level model is configured
  //   - the per-agent override does NOT specify its own model
  const globalModel = userConfig.model;
  const globalModelApplies =
    globalModel !== undefined &&
    (agentOverride === undefined || agentOverride.model === undefined);

  let current: AgentConfig = globalModelApplies ? { ...base, model: globalModel } : base;

  if (agentOverride !== undefined) {
    current = applyAgentOverride(current, agentOverride);
  }

  return current;
}
