---
description: Parallel full context re-scan — batches all stale (new or changed) files across multiple local-context-gatherers running in parallel, each capped at ~80k tokens of file content (~100k with tool overhead).
---

You are executing a full parallel local context gathering. Follow every step in order. Do NOT skip steps.

---

## Step 1 — Detect stale files

Call `cache-ctrl check-files`.

Collect the stale file set:
- From `changed_files`: extract the `path` field of each entry.
- From `new_files`: use each path as-is.

If both lists are empty → report:

> Cache is already up to date — no stale files detected. Nothing to do.

Then stop.

**Cold-start detection**: if `changed_files`, `new_files`, and `unchanged_files` are all empty, the cache has never been populated. Run:

```bash
git ls-files --cached --others --exclude-standard
```

Treat every path returned as stale. If git is unavailable, stop and report that the cache is empty and no file list could be determined — ask the user to run `local-context-gatherer` manually first.

---

## Step 2 — Measure file sizes

Run `wc -c` on all stale files. If the list is large, split into groups of ≤ 50 to avoid ARG_MAX issues:

```bash
wc -c <path1> <path2> ... 2>/dev/null
```

Parse each output line to get `{ path, bytes }`. Skip files that were not found (deleted since check-files ran). For any file that cannot be measured, default its size to 4,000 bytes (~1k tokens — conservative fallback).

Token estimate per file: `bytes ÷ 4` (4 bytes per token, rough average for text files).

---

## Step 3 — Partition into batches

**Token budget per batch**: 80,000 tokens ≈ 320,000 bytes of file content.

Apply the following rules in order:

1. **Identify structural files** — any stale path matching:
   - Exact basename: `AGENTS.md`, `CLAUDE.md`, `install.sh`, `opencode.json`, `package.json`, `pom.xml`
   - Extension pattern: `*.toml`, `*.gradle`, `*.gradle.kts`

   If any structural files are stale → collect all of them into **Batch 0**.
   **Batch 0 is the only batch that may write `global_facts`.**
   Do not apply the 320k byte cap to Batch 0 (structural files are typically small; keeping them together ensures `global_facts` is written by exactly one gatherer).

2. **Fill non-structural batches** — iterate remaining stale files in declaration order:
   - Start a new batch when adding the next file would push the running byte total over 320,000.
   - A single file that exceeds 320,000 bytes alone gets its own dedicated batch.
   - Number these Batch 1, 2, 3, …

3. If no structural files were stale, skip Batch 0 entirely — start from Batch 1.

---

## Step 4 — Build task prompts

Construct one prompt per batch using the appropriate template below. Replace `[FILE LIST]` with the actual paths for that batch (one path per line, prefixed with `- `).

### Template A — Batch 0 (structural files · writes global_facts)

> You are performing a TARGETED partial scan as part of a parallel full-context-gathering run.
>
> **CONSTRAINTS — follow exactly:**
> 1. Read ONLY the files in the FILES section below. Do not scan any other files.
> 2. Run `cache-ctrl check-files` as your normal startup step, but ignore its result when deciding what to read — your scan scope is fixed to the file list below.
> 3. Read each file in full before writing facts.
> 4. This batch contains structural files — you MUST write `global_facts`. Before writing, call `cache-ctrl inspect` with `agent: "local"` and `filter: ["global"]` to read the current value. Merge your new observations with any existing entries — do not discard valid facts already stored.
> 5. Write ONLY the files in this list to `tracked_files` and `facts`. The per-path merge in `cache-ctrl write` preserves all other cached paths automatically.
> 6. Use `topic: "Full parallel repository context scan"` and `description: "Parallel batch scan of all stale files in the repository"` in your write.
> 7. Return ≤ 200 tokens: files read, facts count per file, any read errors.
>
> **FILES:**
> [FILE LIST]

### Template B — Batch 1, 2, … (non-structural files · no global_facts)

> You are performing a TARGETED partial scan as part of a parallel full-context-gathering run.
>
> **CONSTRAINTS — follow exactly:**
> 1. Read ONLY the files in the FILES section below. Do not scan any other files.
> 2. Run `cache-ctrl check-files` as your normal startup step, but ignore its result when deciding what to read — your scan scope is fixed to the file list below.
> 3. Read each file in full before writing facts.
> 4. This batch does NOT contain structural files — you MUST omit `global_facts` from your `cache-ctrl write` call. The existing value is preserved automatically by the per-path merge.
> 5. Write ONLY the files in this list to `tracked_files` and `facts`. The per-path merge in `cache-ctrl write` preserves all other cached paths automatically.
> 6. Use `topic: "Full parallel repository context scan"` and `description: "Parallel batch scan of all stale files in the repository"` in your write.
> 7. Return ≤ 200 tokens: files read, facts count per file, any read errors.
>
> **FILES:**
> [FILE LIST]

---

## Step 5 — Dispatch all batches in parallel

**Issue all `task` calls for `local-context-gatherer` in a SINGLE response** so they run concurrently. Do not wait for one to finish before starting the next.

For each batch:
- `subagent_type`: `"local-context-gatherer"`
- `description`: `"Batch N context scan (M files)"` — use the actual batch number and file count
- `prompt`: the prompt constructed in Step 4 for that batch

---

## Step 6 — Report results

After all gatherers return, output a summary:

```
## Context Gathering Complete

- Total stale files processed : N
- Batches dispatched          : N  (Batch 0: K structural files; Batch 1: M files; …)
- Errors                      : [list any files reported unreadable by any gatherer, or "none"]
- Cache status                : updated
```

If any gatherer reported an error, list the affected paths and suggest re-running `/local-context-full-gathering` after resolving them.
