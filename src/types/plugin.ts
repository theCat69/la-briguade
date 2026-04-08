/**
 * Convenience type aliases derived from the plugin API.
 * Keeps the rest of the codebase independent of import paths
 * and provides a single place to adapt if the upstream API changes.
 */
import type { Plugin } from "@opencode-ai/plugin";

/** The context object passed to the plugin entry function. */
export type PluginInput = Parameters<Plugin>[0];

/** The hooks object returned by the plugin entry function. */
export type HooksResult = Awaited<ReturnType<Plugin>>;

/**
 * The Config object received by the `config` hook.
 * Extracted from the first parameter of `HooksResult["config"]`.
 */
export type Config = Parameters<NonNullable<HooksResult["config"]>>[0];
