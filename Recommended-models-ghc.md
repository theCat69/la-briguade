# Recommended Models — GitHub Copilot (Pro / Pro+)

> Last updated: 2026-04-09
> Source: [GitHub Docs — Requests in GitHub Copilot](https://gh.io/copilot-premium-request-docs)
> Plan: **GitHub Copilot Pro / Pro+** (per-prompt premium request subscription)
> Monthly allowance: **300 premium requests/month** (Pro) — resets on the 1st of each month UTC

---

## All Available Models — Multiplier Reference

GPT-5 mini, GPT-4.1, and GPT-4o are **included models** on paid plans and consume **zero** premium requests.
All other models consume premium requests according to their multiplier.

| Model | Multiplier (paid plan) | Effective prompts / 300 req budget |
|---|---|---|
| `github-copilot/gpt-4o` | **0×** (free) | Unlimited |
| `github-copilot/gpt-4.1` | **0×** (free) | Unlimited |
| `github-copilot/gpt-5-mini` | **0×** (free) | Unlimited |
| `github-copilot/grok-code-fast-1` | **0.25×** | ~1 200 prompts |
| `github-copilot/claude-haiku-4.5` | **0.33×** | ~909 prompts |
| `github-copilot/gemini-3-flash-preview` | **0.33×** | ~909 prompts |
| `github-copilot/gpt-5.4-mini` | **0.33×** | ~909 prompts |
| `github-copilot/claude-sonnet-4` | **1×** | 300 prompts |
| `github-copilot/claude-sonnet-4.5` | **1×** | 300 prompts |
| `github-copilot/claude-sonnet-4.6` | **1×** | 300 prompts |
| `github-copilot/gemini-2.5-pro` | **1×** | 300 prompts |
| `github-copilot/gemini-3.1-pro-preview` | **1×** | 300 prompts |
| `github-copilot/gpt-5.1` | **1×** | 300 prompts |
| `github-copilot/gpt-5.2` | **1×** | 300 prompts |
| `github-copilot/gpt-5.2-codex` | **1×** | 300 prompts |
| `github-copilot/gpt-5.3-codex` | **1×** | 300 prompts |
| `github-copilot/gpt-5.4` | **1×** | 300 prompts |
| `github-copilot/claude-opus-4.5` | **3×** | ~100 prompts |
| `github-copilot/claude-opus-4.6` | **3×** | ~100 prompts |

> **Note**: `claude-opus-4.6 (fast mode)` exists as a separate preview variant at **30×** — not listed above as it is not in your available models list.
>
> **Auto model selection discount**: When using VS Code's auto model selection, all models receive a **10% multiplier discount** (e.g. Sonnet 4.6 → 0.9×, Opus 4.6 → 2.7×). Not available on Copilot Free.
>
> **Overage pricing**: If you exhaust your 300 req/month allowance, additional premium requests are billed at **$0.04 × multiplier** per prompt.

---

## Recommended Model per Agent

### Selection Criteria

Each agent was matched to a model based on four dimensions:

| Dimension | What it demands | Best fit |
|---|---|---|
| Deep multi-step orchestration / adversarial reasoning | Long context, planning depth | Opus 4.6 |
| Production code writing | Precision, correctness, instruction-following | GPT-5.3-Codex / Sonnet 4.6 |
| Code review / analysis | Pattern recognition, nuance, language quality | Sonnet 4.6 / Gemini 2.5 Pro |
| High-throughput scoped tasks | Speed, tool-use, parallelisable | Grok Code Fast 1 / GPT-5.4-mini |
| Conversational / long-form design | Natural reasoning, structured synthesis | Gemini 2.5 Pro / Sonnet 4.6 |

---

### Primary Agents (user-facing, full-session)

| Agent | Recommended Model | Multiplier | Rationale |
|---|---|---|---|
| **orchestrator** | `github-copilot/claude-opus-4.6` | **3×** | Manages the entire multi-agent pipeline: decomposes tasks, writes context snapshots to `.ai/`, makes all delegation decisions, drives the commit workflow. Requires the deepest reasoning and strongest instruction-following in your model list. Opus 4.6 is the top choice despite its cost. |
| **planner** | `github-copilot/gemini-2.5-pro` | **1×** | Runs Socratic deep-interview loops (ambiguity scoring), synthesises feature specs, and chains critic → feature-designer → feature-reviewer. Long-context structured reasoning is its core demand. Gemini 2.5 Pro matches Opus quality on long-form planning at 3× lower cost. |
| **builder** | `github-copilot/claude-sonnet-4.6` | **1×** | Writes code directly for small–medium tasks, runs the startup sequence (loads skills, checks cache), drives unslop passes, and can run a full review pipeline. Needs strong code generation + instruction-following without Opus-level cost. Sonnet 4.6 is the sweet spot. |
| **ask** | `github-copilot/claude-sonnet-4.6` | **1×** | Conversational assistant that delegates to subagents. Needs broad knowledge, natural language fluency, and reliable tool use. Sonnet 4.6 covers all of this at a 1× rate. |

---

### Code Subagents

| Agent | Recommended Model | Multiplier | Rationale |
|---|---|---|---|
| **coder** | `github-copilot/gpt-5.3-codex` | **1×** | Pure production code writer working from a curated context snapshot provided by the Orchestrator. No ambiguity resolution, no planning — only precise, correct, tested code generation. Codex models are purpose-built for this. GPT-5.3-Codex is the best code-specialised model in the list at 1×. |

---

### Review / Analysis Subagents

| Agent | Recommended Model | Multiplier | Rationale |
|---|---|---|---|
| **reviewer** | `github-copilot/claude-sonnet-4.6` | **1×** | Full-codebase review for correctness, architecture, and maintainability. Requires deep understanding of TypeScript ESM patterns, plugin conventions, and the project's SOLID principles. Sonnet 4.6 has the best code comprehension at 1×. |
| **security-reviewer** | `github-copilot/gemini-2.5-pro` | **1×** | CVE lookup via GitHub Advisory Database, OWASP pattern matching, full-codebase security sweeps. Gemini 2.5 Pro's large context window handles whole-codebase analysis with nuanced threat reasoning. Strong alternative to Sonnet 4.6 for this read-heavy analytical task. |
| **critic** | `github-copilot/claude-opus-4.6` | **3×** | Adversarial first-principles challenger — surfaces hidden assumptions, questions necessity, proposes simpler alternatives. This is the highest-order reasoning task in the pipeline. Even though output is bounded at ≤300 tokens, generating a genuinely sharp challenge requires Opus-depth. The 3× cost is justified by the value of blocking bad designs early. |
| **feature-reviewer** | `github-copilot/claude-sonnet-4.6` | **1×** | Spec quality gate: blocks ambiguous, non-implementable, or production-unsafe features. Requires strong language understanding to evaluate specs against production-readiness criteria. Sonnet 4.6 is the right fit at 1×. |

---

### Design Subagents

| Agent | Recommended Model | Multiplier | Rationale |
|---|---|---|---|
| **feature-designer** | `github-copilot/gemini-2.5-pro` | **1×** | Transforms vague user ideas into structured, implementable feature specs with production constraints (scalability, rollback, backward compatibility). Requires PM-level structured thinking combined with technical depth. Gemini 2.5 Pro excels at long creative+technical synthesis. |

---

### Context & Documentation Subagents

| Agent | Recommended Model | Multiplier | Rationale |
|---|---|---|---|
| **local-context-gatherer** | `github-copilot/grok-code-fast-1` | **0.25×** | Mechanical task: read files, extract facts, write cache via `cache_ctrl_write`. Pure throughput — no creative reasoning needed. Grok Code Fast 1 is the cheapest code-capable model in the list at 0.25×, ideal for parallel batch scans where multiple instances run concurrently. |
| **external-context-gatherer** | `github-copilot/gpt-5.4-mini` | **0.33×** | Web search + MCP tool calls (context7, GitHub Advisory Database) + cache writes. Fast, tool-use capable, no deep reasoning required. GPT-5.4-mini handles tool-heavy workflows efficiently at low cost. |
| **librarian** | `github-copilot/claude-sonnet-4.6` | **1×** | Keeps README, AGENTS.md, and `.code-examples-for-ai/` in sync with code changes. Requires understanding *what changed* and *why it matters* for documentation — language quality is essential. Sonnet 4.6 is the right fit. |

---

## Summary — Copy-Paste Ready for Agent Frontmatter

```yaml
# Primary agents
orchestrator:  github-copilot/claude-opus-4.6      # 3×
planner:       github-copilot/gemini-2.5-pro        # 1×
builder:       github-copilot/claude-sonnet-4.6     # 1×
ask:           github-copilot/claude-sonnet-4.6     # 1×

# Code subagents
coder:         github-copilot/gpt-5.3-codex         # 1×

# Review subagents
reviewer:              github-copilot/claude-sonnet-4.6    # 1×
security-reviewer:     github-copilot/gemini-2.5-pro       # 1×
critic:                github-copilot/claude-opus-4.6      # 3×
feature-reviewer:      github-copilot/claude-sonnet-4.6    # 1×

# Design subagents
feature-designer:      github-copilot/gemini-2.5-pro       # 1×

# Context & docs subagents
local-context-gatherer:    github-copilot/grok-code-fast-1  # 0.25×
external-context-gatherer: github-copilot/gpt-5.4-mini      # 0.33×
librarian:                 github-copilot/claude-sonnet-4.6  # 1×
```

---

## Budget Impact Analysis

### Monthly consumption estimate (Pro — 300 req budget)

Assuming a typical active development session: 1 Orchestrator run, 3 Builder tasks, 5 review cycles, 10 context scans, 2 Planner sessions, 1 critic challenge.

| Agent | Sessions | Multiplier | Premium requests used |
|---|---|---|---|
| orchestrator (Opus 4.6) | 1 | 3× | 3 |
| critic (Opus 4.6) | 1 | 3× | 3 |
| planner (Gemini 2.5 Pro) | 2 | 1× | 2 |
| builder (Sonnet 4.6) | 3 | 1× | 3 |
| ask (Sonnet 4.6) | 10 | 1× | 10 |
| coder (GPT-5.3-Codex) | 3 | 1× | 3 |
| reviewer (Sonnet 4.6) | 3 | 1× | 3 |
| security-reviewer (Gemini 2.5 Pro) | 2 | 1× | 2 |
| feature-reviewer (Sonnet 4.6) | 2 | 1× | 2 |
| feature-designer (Gemini 2.5 Pro) | 1 | 1× | 1 |
| librarian (Sonnet 4.6) | 2 | 1× | 2 |
| local-context-gatherer (Grok Fast) | 10 | 0.25× | 2.5 |
| external-context-gatherer (GPT-5.4-mini) | 5 | 0.33× | 1.65 |
| **Total** | | | **~38 req / session** |

A typical session consumes ~38 premium requests, leaving significant headroom within the 300/month Pro budget (~7–8 full sessions/month before hitting the cap).

### Budget risk: Opus agents

The two Opus agents (orchestrator, critic) are the only budget risk. If you run Orchestrator heavily (e.g. 10+ runs/month with multi-turn sessions), budget pressure increases. Mitigations:

- **Swap orchestrator to Sonnet 4.6 (1×)** if you are budget-constrained — you lose some orchestration depth but gain 3× more headroom.
- **Reserve Opus only for critic** — its output is short (≤300 tokens) so the 3× cost is concentrated in a single focused call.
- **Use VS Code auto model selection** — qualifies for a 10% discount on all models (Opus 4.6 drops to 2.7×, Sonnet 4.6 to 0.9×).

### Models NOT recommended and why

| Model | Reason skipped |
|---|---|
| `github-copilot/claude-haiku-4.5` | Too weak for any agent role here — even context gatherers benefit from code-specialised fast alternatives |
| `github-copilot/claude-opus-4.5` | Superseded by Opus 4.6 — same 3× cost, lower capability |
| `github-copilot/claude-sonnet-4` / `4.5` | Superseded by Sonnet 4.6 — same 1× cost, lower capability |
| `github-copilot/gemini-3-flash-preview` | Preview/unstable — avoid for production pipelines; use GPT-5.4-mini instead (same 0.33×, more stable) |
| `github-copilot/gemini-3.1-pro-preview` | Preview/unstable — use Gemini 2.5 Pro instead (same 1×, GA quality) |
| `github-copilot/gpt-4.1` | Free but superseded for premium tasks — included model, good fallback only |
| `github-copilot/gpt-4o` | Free but superseded for premium tasks — included model, good fallback only |
| `github-copilot/gpt-5-mini` | Free included model — use as fallback when budget is exhausted, not as primary |
| `github-copilot/gpt-5.1` / `gpt-5.2` / `gpt-5.4` | All valid at 1×, but GPT-5.3-Codex and Sonnet 4.6 are better specialised for their respective roles |
| `github-copilot/gpt-5.2-codex` | Superseded by GPT-5.3-Codex — same 1× cost, lower code generation capability |
