import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, isAbsolute, join, relative, sep } from "node:path";

import { z } from "zod";

import { parseFrontmatter } from "../utils/content/frontmatter.js";
import { logger } from "../utils/runtime/logger.js";
import { isNodeError, isRecord } from "../utils/support/type-guards.js";
import type { Config } from "../types/plugin.js";

const AUTO_INJECT_START_MARKER = ">>>>> AUTO-INJECTED-SKILLS-START >>>>>";
const AUTO_INJECT_END_MARKER = "<<<<< AUTO-INJECTED-SKILLS-END <<<<<";
const AUTO_INJECT_PREFACE =
  "The following content is already-loaded auto-injected skills. " +
  "Each skill is shown as '#skill-name', then description, then body.";
const FALLBACK_IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".git",
  ".next",
  ".turbo",
  ".venv",
  ".yarn",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);
const MAX_DETECTION_DIRECTORIES = 1_000;
const MAX_GIT_FILE_LIST_BYTES = 50 * 1024 * 1024;
const MAX_AUTO_INJECT_SKILL_LENGTH = 50_000;

interface DetectionFileIndex {
  pathsByName: Map<string, string[]>;
  projectPaths: Set<string>;
  usesGitIndex: boolean;
}

function buildGroupedAutoInjectBlock(entries: AutoInjectEntry[]): string {
  const skillSections = entries
    .map((entry) => `#${entry.skillName}\n${entry.skillDecription}\n${entry.body}`)
    .join("\n\n");

  return [
    "---",
    AUTO_INJECT_START_MARKER,
    AUTO_INJECT_PREFACE,
    "",
    skillSections,
    AUTO_INJECT_END_MARKER,
    "---",
  ].join("\n");
}

const DetectContentEntrySchema = z.object({
  file: z.string(),
  contains: z.string(),
});

const DetectSchema = z.object({
  files: z.array(z.string()).optional(),
  content: z.array(DetectContentEntrySchema).optional(),
});

const AutoInjectFrontmatterSchema = z.object({
  agents: z.array(z.string()).optional(),
  description: z.string().optional(),
  detect: DetectSchema.optional(),
});

/** A single auto-inject skill entry, parsed from a SKILL.md file. */
export type AutoInjectEntry = {
  skillName: string;
  skillDecription: string;
  body: string;
  /** Agent names this skill should be injected into (from `agents:` frontmatter). */
  agents: string[];
  /** Files that must exist in projectDir for this skill to be active (OR logic). */
  detectFiles: string[];
  /** File+content pairs that activate the skill when matched (OR logic). */
  detectContent: Array<{ file: string; contains: string }>;
};

/** Options that bound recursive auto-inject detection. */
export interface AutoInjectDetectionOptions {
  /** Maximum directory depth below project root to inspect. Zero checks only project root. */
  maxDepth?: number;
}

function isSafeDetectionPath(projectDir: string, detectionPath: string): boolean {
  if (detectionPath.length === 0 || isAbsolute(detectionPath)) {
    return false;
  }

  const resolvedPath = join(projectDir, detectionPath);
  const relativePath = relative(projectDir, resolvedPath);
  return relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${sep}`);
}

function buildDetectionFileIndex(
  projectDir: string,
  maxDepth: number,
  detectionFileNames: ReadonlySet<string>,
): DetectionFileIndex {
  return buildGitDetectionFileIndex(projectDir, maxDepth, detectionFileNames) ??
    buildFallbackDetectionFileIndex(projectDir, maxDepth, detectionFileNames);
}

function buildGitDetectionFileIndex(
  projectDir: string,
  maxDepth: number,
  detectionFileNames: ReadonlySet<string>,
): DetectionFileIndex | undefined {
  let output: Buffer;
  try {
    output = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
      cwd: projectDir,
      encoding: "buffer",
      maxBuffer: MAX_GIT_FILE_LIST_BYTES,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    if (existsSync(join(projectDir, ".git"))) {
      logger.warn(`Could not read Git file list for auto-inject detection under: ${projectDir}`);
      return { pathsByName: new Map(), projectPaths: new Set(), usesGitIndex: true };
    }
    return undefined;
  }

  const pathsByName = new Map<string, string[]>();
  const projectPaths = new Set<string>();
  for (const projectPath of output.toString("utf8").split("\0")) {
    if (projectPath.length === 0 || !isSafeDetectionPath(projectDir, projectPath)) {
      continue;
    }

    const pathDepth = getDetectionPathDepth(projectPath);
    if (pathDepth > maxDepth) {
      continue;
    }

    const absolutePath = join(projectDir, projectPath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    projectPaths.add(absolutePath);
    const fileName = basename(projectPath);
    if (detectionFileNames.has(fileName)) {
      const matchingPaths = pathsByName.get(fileName) ?? [];
      matchingPaths.push(absolutePath);
      pathsByName.set(fileName, matchingPaths);
    }
  }

  return { pathsByName, projectPaths, usesGitIndex: true };
}

function buildFallbackDetectionFileIndex(
  projectDir: string,
  maxDepth: number,
  detectionFileNames: ReadonlySet<string>,
): DetectionFileIndex {
  const pathsByName = new Map<string, string[]>();
  const projectPaths = new Set<string>();

  let scannedDirectories = 0;
  let reachedDirectoryLimit = false;
  const visitDirectory = (directory: string, depth: number): void => {
    if (scannedDirectories >= MAX_DETECTION_DIRECTORIES) {
      reachedDirectoryLimit = true;
      return;
    }
    scannedDirectories += 1;

    let entries: Dirent<string>[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = join(directory, entry.name);
      if (entry.isFile()) {
        projectPaths.add(entryPath);
        if (detectionFileNames.has(entry.name)) {
          const matchingPaths = pathsByName.get(entry.name) ?? [];
          matchingPaths.push(entryPath);
          pathsByName.set(entry.name, matchingPaths);
        }
      } else if (
        entry.isDirectory() &&
        depth < maxDepth &&
        !FALLBACK_IGNORED_DIRECTORIES.has(entry.name)
      ) {
        visitDirectory(entryPath, depth + 1);
      }
    }
  };

  visitDirectory(projectDir, 0);
  if (reachedDirectoryLimit) {
    logger.warn(
      `Auto-inject detection stopped after scanning ${MAX_DETECTION_DIRECTORIES} directories ` +
      `under: ${projectDir}`,
    );
  }
  return { pathsByName, projectPaths, usesGitIndex: false };
}

function getDetectionPathDepth(detectionPath: string): number {
  return detectionPath.split(/[\\/]+/).filter((part) => part !== ".").length - 1;
}

function findDetectionPaths(
  projectDir: string,
  detectionPath: string,
  maxDepth: number,
  fileIndex: DetectionFileIndex,
): string[] {
  if (!isSafeDetectionPath(projectDir, detectionPath)) {
    return [];
  }

  if (maxDepth === 0 || detectionPath.includes("/") || detectionPath.includes("\\")) {
    const pathDepth = getDetectionPathDepth(detectionPath);
    if (pathDepth > maxDepth) {
      return [];
    }
    const exactPath = join(projectDir, detectionPath);
    if (!fileIndex.usesGitIndex) {
      return existsSync(exactPath) ? [exactPath] : [];
    }
    return fileIndex.projectPaths.has(exactPath) ? [exactPath] : [];
  }

  return fileIndex.pathsByName.get(detectionPath) ?? [];
}

function hasContentMatch(filePaths: string[], contains: string): boolean {
  for (const filePath of filePaths) {
    try {
      if (readFileSync(filePath, "utf8").includes(contains)) {
        return true;
      }
    } catch {
      // Unreadable files are not treated as active matches.
    }
  }

  return false;
}

/**
 * Read each auto-inject skill directory, parse its SKILL.md frontmatter and body,
 * and return a map from skill name to entry.
 *
 * Skips dirs where SKILL.md is absent (ENOENT). Warns and skips on other read
 * errors or invalid frontmatter.
 *
 * @param skillDirs - Full paths to individual skill subdirectories
 *   (e.g. `/content/auto-inject-skills/general-coding`)
 */
export function collectAutoInjectSkills(skillDirs: string[]): Map<string, AutoInjectEntry> {
  const entries = new Map<string, AutoInjectEntry>();

  for (const skillDir of skillDirs) {
    const skillName = basename(skillDir);
    const skillFilePath = join(skillDir, "SKILL.md");

    let skillFileSize: number;
    try {
      skillFileSize = statSync(skillFilePath).size;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        logger.warn(
          `Could not inspect auto-inject skill file: ${skillFilePath} ` +
          `(${error instanceof Error ? error.message : String(error)})`,
        );
      }
      continue;
    }

    if (skillFileSize > MAX_AUTO_INJECT_SKILL_LENGTH) {
      logger.warn(`Auto-inject skill file exceeds size limit: ${skillFilePath}`);
      continue;
    }

    let rawContent: string;
    try {
      rawContent = readFileSync(skillFilePath, "utf8");
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        logger.warn(
          `Could not read auto-inject skill file: ${skillFilePath} ` +
          `(${error instanceof Error ? error.message : String(error)})`,
        );
      }
      continue;
    }

    if (rawContent.length > MAX_AUTO_INJECT_SKILL_LENGTH) {
      logger.warn(`Auto-inject skill file exceeds size limit: ${skillFilePath}`);
      continue;
    }

    const { attributes, body } = parseFrontmatter(rawContent);

    const parsed = AutoInjectFrontmatterSchema.safeParse(attributes);
    if (!parsed.success) {
      logger.warn(`Invalid auto-inject skill frontmatter in: ${skillFilePath}`);
      continue;
    }

    const { agents = [], description, detect } = parsed.data;

    entries.set(skillName, {
      skillName,
      skillDecription: description ?? "",
      body: body.trim(),
      agents,
      detectFiles: detect?.files ?? [],
      detectContent: detect?.content ?? [],
    });
  }

  return entries;
}

/**
 * Determine which auto-inject skills are active for the given project directory.
 *
 * A skill with no `detect` constraints is always active. A skill with
 * `detect.files` is active if any listed file exists (OR logic). A skill with
 * `detect.content` is active if any listed entry has a file that exists and
 * contains the specified substring (OR logic).
 *
 * @param entries - Collected auto-inject entries (from `collectAutoInjectSkills`)
 * @param projectDir - Absolute path to the project root to check file existence
 * @param options - Optional bounded recursive detection settings
 */
export function resolveActiveSkills(
  entries: Map<string, AutoInjectEntry>,
  projectDir: string,
  options: AutoInjectDetectionOptions = {},
): Set<string> {
  const active = new Set<string>();
  const maxDepth = options.maxDepth ?? 0;
  const detectionFileNames = new Set<string>();
  for (const entry of entries.values()) {
    for (const file of entry.detectFiles) {
      if (!file.includes("/") && !file.includes("\\")) {
        detectionFileNames.add(file);
      }
    }
    for (const { file } of entry.detectContent) {
      if (!file.includes("/") && !file.includes("\\")) {
        detectionFileNames.add(file);
      }
    }
  }
  const fileIndex = buildDetectionFileIndex(projectDir, maxDepth, detectionFileNames);

  for (const [skillName, entry] of entries) {
    if (entry.detectFiles.length === 0 && entry.detectContent.length === 0) {
      active.add(skillName);
      continue;
    }

    for (const file of entry.detectFiles) {
      if (findDetectionPaths(projectDir, file, maxDepth, fileIndex).length > 0) {
        active.add(skillName);
        break;
      }
    }

    if (active.has(skillName)) {
      continue;
    }

    for (const { file, contains } of entry.detectContent) {
      const filePaths = findDetectionPaths(projectDir, file, maxDepth, fileIndex);
      if (hasContentMatch(filePaths, contains)) {
        active.add(skillName);
        break;
      }
    }
  }

  return active;
}

/**
 * Append each active auto-inject skill body to matching agent prompts.
 *
 * A skill is injected into an agent if:
 *  - The skill's `agents:` list includes the agent name, OR
 *  - The agent has an explicit `permission.skill["<skillName>"] = "allow" | "ask"`
 *
 * Wildcards (`"*"`) do NOT trigger injection — explicit authorization only.
 * Must be called after `injectSkillAgentPermissions` so that `permission.skill`
 * entries set via `agents:` opt-in are already present.
 *
 * @param input - The mutable plugin config object
 * @param entries - Collected auto-inject entries
 * @param activeSkills - Set of skill names active for the current project
 */
export function injectAutoInjectSkills(
  input: Config,
  entries: Map<string, AutoInjectEntry>,
  activeSkills: Set<string>,
): void {
  if (!isRecord(input.agent)) {
    return;
  }

  for (const [agentName, agentConfig] of Object.entries(input.agent)) {
    if (!isRecord(agentConfig)) {
      continue;
    }

    const rawPermission: unknown = agentConfig["permission"];
    const rawSkillPerms: Record<string, unknown> =
      isRecord(rawPermission) && isRecord(rawPermission["skill"])
        ? rawPermission["skill"]
        : {};

    const injectableEntries: AutoInjectEntry[] = [];

    for (const [skillName, entry] of entries) {
      if (!activeSkills.has(skillName)) {
        continue;
      }

      if (entry.body.length === 0) {
        continue;
      }

      const inAgentsList = entry.agents.includes(agentName);
      const explicitPerm = rawSkillPerms[skillName];
      const hasExplicitPermission = explicitPerm === "allow" || explicitPerm === "ask";

      if (!inAgentsList && !hasExplicitPermission) {
        continue;
      }

      injectableEntries.push(entry);
    }

    if (injectableEntries.length === 0) {
      continue;
    }

    const existingPrompt = agentConfig["prompt"];
    const promptStr = typeof existingPrompt === "string" ? existingPrompt : "";
    const hasMeaningfulPrompt = promptStr.trim().length > 0;
    const firstInjectableEntry = injectableEntries[0];

    if (firstInjectableEntry == null) {
      continue;
    }

    if (!hasMeaningfulPrompt) {
      const remainingEntries = injectableEntries.slice(1);
      const groupedRemainder =
        remainingEntries.length > 0 ? `\n\n${buildGroupedAutoInjectBlock(remainingEntries)}` : "";
      agentConfig["prompt"] = `${firstInjectableEntry.body}${groupedRemainder}`;
      continue;
    }

    agentConfig["prompt"] = `${promptStr}\n\n${buildGroupedAutoInjectBlock(injectableEntries)}`;
  }
}
