---
name: serena
description: Semantic code retrieval, editing, refactoring and debugging tools using LSP servers
agents:
  - builder 
  - coder 
mcp:
  serena:
    type: local
    command:
      - "uvx"
      - "--from"
      - "git+https://github.com/oraios/serena"
      - "serena"
      - "start-mcp-server"
      - "--project-from-cwd"
      - "--context"
      - "agent"
      - "--open-web-dashboard"
      - "False"
    enabled: true
---

# Skill: serena

Use Serena as the default MCP for repo-local code understanding, symbol-aware navigation, safe refactoring, and persistent project memory.

## Why Serena is useful

Serena is valuable because it is **structure-aware**, not just text-aware.

It helps an agent:
- find the right files faster
- understand symbols, declarations, implementations, and references
- make safer edits than raw search/replace
- perform cross-file refactors with less risk
- store reusable project knowledge in memories
- inspect diagnostics before and after changes

Use Serena first for **local repository work**.  
Do not use it for external library documentation; use dedicated external-doc tools for that.

---

## When to use Serena

Use Serena when you need to:
- explore an unfamiliar codebase
- locate a class, method, interface, or symbol
- find who calls or implements something
- make precise code edits around existing symbols
- rename or delete symbols safely
- inspect diagnostics in a file
- save project knowledge for future tasks

Prefer Serena over plain text tools when the task is about **code structure**.

---

## Core workflow

Follow this order unless you already know exactly what you need.

### 1. Confirm Serena is available
Call:
- `get_current_config`

Use this to verify:
- active project
- backend
- active tools
- active modes

If Serena is unavailable, stop and report that.

---

### 2. Activate the correct project if needed
Call:
- `activate_project`

Do this before project-wide navigation if the active project is wrong or missing.

---

### 3. Start broad, then narrow
For a new area of the codebase, prefer:
- `list_dir`
- `find_file`
- `get_symbols_overview`

This gives quick orientation before deeper symbol lookups.

Recommended pattern:
1. locate candidate files
2. inspect file-level symbols
3. drill into specific symbols

---

### 4. Use symbol tools for understanding
Prefer these tools over raw text search when possible:

- `find_symbol` — locate symbols by name/path
- `find_declaration` — jump to the source definition
- `find_implementations` — find concrete implementations
- `find_referencing_symbols` — find usages and callers
- `get_symbols_overview` — inspect the symbol map of a file

Use these when you care about:
- exact methods
- class hierarchies
- usage impact
- refactor safety

---

### 5. Read only what you need
Use:
- `read_file`

Read targeted files or sections after you identify them through symbol/file discovery.  
Avoid loading large files too early when symbol tools can narrow the scope first.

---

### 6. Choose the safest edit tool
Prefer the most structured edit tool available.

Use:
- `insert_before_symbol` / `insert_after_symbol` for adding imports, methods, classes, or declarations
- `replace_symbol_body` when changing only a known method/function body
- `replace_content` for targeted single-file edits
- `replace_in_files` for repeated small changes across multiple files
- `rename_symbol` for semantic renames
- `safe_delete_symbol` for removing unused symbols
- `create_text_file` for new files

Rule:
- prefer **symbol-level edits**
- fall back to content replacement only when symbol tools are not a good fit

---

### 7. Verify impact
Before and after non-trivial edits, use:
- `find_referencing_symbols`
- `get_diagnostics_for_file`

This helps confirm:
- what depends on the changed symbol
- whether the file has compiler/LSP issues

---

### 8. Store reusable knowledge
Use Serena memory tools to avoid rediscovery later:

- `list_memories`
- `read_memory`
- `write_memory`
- `edit_memory`
- `rename_memory`
- `delete_memory`

Good memory candidates:
- architecture notes
- naming conventions
- test commands
- module responsibilities
- tricky framework constraints
- user preferences relevant to the repo

Do **not** store raw logs or huge copied outputs. Store concise distilled facts.

---

## Tool selection guide

### Repo orientation
Use:
- `get_current_config`
- `list_dir`
- `find_file`
- `get_symbols_overview`

### Find where logic lives
Use:
- `find_symbol`
- `find_declaration`
- `find_implementations`
- `find_referencing_symbols`

### Inspect code
Use:
- `read_file`

### Safe code changes
Use:
- `insert_before_symbol`
- `insert_after_symbol`
- `replace_symbol_body`
- `replace_content`
- `replace_in_files`
- `rename_symbol`
- `safe_delete_symbol`

### Quality checks
Use:
- `get_diagnostics_for_file`

### Persistent project knowledge
Use:
- `write_memory`
- `read_memory`
- `list_memories`

### Last-resort text search
Use:
- `search_for_pattern`

### Shell fallback
Use:
- `execute_shell_command`

Only use shell when Serena’s native tools are insufficient.

---

## Recommended patterns

### Pattern: understand a method safely
1. `find_symbol`
2. `find_declaration`
3. `find_referencing_symbols`
4. `read_file`

### Pattern: change a method body
1. `find_symbol`
2. read the symbol/file
3. `replace_symbol_body`
4. `get_diagnostics_for_file`

### Pattern: rename something across the repo
1. `find_symbol`
2. `find_referencing_symbols`
3. `rename_symbol`
4. `get_diagnostics_for_file`

### Pattern: remove dead code
1. `safe_delete_symbol`
2. if blocked, inspect references
3. remove callers/usages first
4. retry deletion

### Pattern: repeated edits in many files
1. use `replace_in_files` with dry run if risk exists
2. apply only intended occurrences
3. inspect diagnostics in touched files

### Pattern: explore an unfamiliar file
1. `get_symbols_overview`
2. `find_symbol` for the interesting symbol
3. `read_file` only after narrowing scope

---

## Decision rules

### Prefer Serena over raw grep when:
- you know the symbol name
- you need declarations, references, or implementations
- the change should be structurally safe
- the repo is large enough that text matches are noisy

### Prefer text search when:
- you are looking for string literals, config keys, SQL fragments, or annotations
- the target is not represented well as a symbol
- you need broad regex matching

### Prefer memory tools when:
- the fact will matter again later
- the fact is project-specific
- the fact is stable enough to be worth saving

---

## Safety rules

- Always confirm the active project before deep work.
- Start with overview tools before editing.
- Prefer symbol-aware tools over blind text replacement.
- Inspect references before renaming or deleting.
- Check diagnostics after edits.
- Use memories for distilled knowledge, not raw dumps.
- Treat Serena as the primary tool for repo-local code intelligence.

---

## Anti-patterns

Avoid:
- reading many large files before using symbol discovery
- using raw replacements when `rename_symbol` or symbol edits would be safer
- deleting code without checking references
- storing noisy or temporary data in memory
- using Serena for external library docs instead of external documentation tools

---

## Minimal operating checklist

For most coding tasks:
1. `get_current_config`
2. activate project if needed
3. `find_file` or `get_symbols_overview`
4. `find_symbol` / references / implementations
5. read targeted code
6. edit with the safest Serena tool
7. inspect diagnostics
8. write memory if the insight is reusable
