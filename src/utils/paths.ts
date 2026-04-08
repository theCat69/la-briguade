import { resolve, join } from "node:path";

/**
 * Resolve the absolute path to the plugin's bundled content directory.
 * Works regardless of whether the consumer installed via npm or linked locally.
 *
 * @param baseUrl - Typically `import.meta.url` from the calling module
 * @returns Absolute path to the content/ directory
 */
export function resolveContentDir(baseUrl: string): string {
  return new URL("../../content", baseUrl).pathname;
}

/**
 * Build the path for a specific content subdirectory.
 */
export function contentSubDir(
  contentDir: string,
  subdirectory: "agents" | "skills" | "commands",
): string {
  return resolve(contentDir, subdirectory);
}

/**
 * Build the full path to a specific content file.
 */
export function contentFilePath(
  contentDir: string,
  subdirectory: "agents" | "skills" | "commands",
  filename: string,
): string {
  return join(resolve(contentDir, subdirectory), filename);
}
