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
    let prompt: string | undefined = current.prompt;
    if (agentOverride.systemPromptSuffix !== undefined) {
      prompt =
        prompt !== undefined && prompt !== ""
          ? `${prompt}\n\n${agentOverride.systemPromptSuffix}`
          : agentOverride.systemPromptSuffix;
    }

    const merged: AgentConfig = { ...current };

    if (agentOverride.model !== undefined) {
      merged["model"] = agentOverride.model;
    }

    if (agentOverride.temperature !== undefined) {
      merged["temperature"] = agentOverride.temperature;
    }

    if (agentOverride.topP !== undefined) {
      merged["top_p"] = agentOverride.topP;
    }

    if (agentOverride.topK !== undefined) {
      merged["topK"] = agentOverride.topK;
    }
    if (agentOverride.variant !== undefined) {
      merged.variant = agentOverride.variant;
    }
    if (agentOverride.maxTokens !== undefined) {
      merged["maxTokens"] = agentOverride.maxTokens;
    }

    if (prompt !== undefined) {
      merged["prompt"] = prompt;
    }

    if (agentOverride.permission !== undefined) {
      const basePermission = isRecord(current.permission) ? current.permission : {};
      merged["permission"] = {
        ...basePermission,
        ...agentOverride.permission,
      };
    }

    current = merged;
  }

  return current;
}
