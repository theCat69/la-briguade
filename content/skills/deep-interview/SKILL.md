---
name: deep-interview
description: Socratic requirements gathering with mathematical ambiguity scoring — proceed only when ambiguity < 20%
agents:
  - planner
  - builder
  - orchestrator
---

# Deep Interview — Requirements Clarification

**Purpose**: replace vague or incomplete user requests with crystal-clear, measurable specifications before any code is written or any implementation agent is called. No implementation begins while the interview is in progress.

## When to Load This Skill

Load this skill when one or more of the following ambiguity signals is present in the user's request:

- **Vague action verbs** — "improve", "fix", "make better", "clean up", "rework", "optimize" with no measurable specifics
- **No success criteria** — no definition of done, no observable end state, nothing a third party could verify
- **Scope creep words** — "maybe", "possibly", "or maybe also", "might", "could also"
- **Contradictory requirements** — two stated goals that cannot both be satisfied simultaneously
- **Missing constraints** — no mention of what NOT to do; no performance, security, or compatibility constraints stated
- **Undefined entities** — references to "it", "the thing", "this" without a clear antecedent in the conversation

## Ambiguity Scoring

Score the request across three weighted dimensions. Each dimension is scored 0–100% for clarity. The weighted sum is the overall **Clarity %**. **Ambiguity % = 100 − Clarity %**.

| Dimension | Weight | Question |
|---|---|---|
| **Goal Clarity** | 40% | Is the desired end state unambiguous and measurable? |
| **Constraint Clarity** | 30% | Are technical, scope, and non-functional constraints specified? |
| **Success Criteria** | 30% | Are acceptance criteria concrete and verifiable by a third party? |

**Example**: Goal 60%, Constraints 50%, Success 40% → Clarity = (0.40×60) + (0.30×50) + (0.30×40) = **51%**; Ambiguity = **49%** (interview required).

**Proceed threshold**: Ambiguity < 20% (Clarity > 80%).

## Interview Workflow

1. Score the request across all 3 dimensions. Report the score explicitly: each dimension's clarity %, the weighted clarity %, and the ambiguity %.
2. **If ambiguity < 20%**: state "Requirements are clear. Proceeding." and stop — do not ask any questions.
3. **If ambiguity ≥ 20%**: identify the highest-impact clarifying questions for the dominant ambiguity dimension. When 2–3 closely related questions all target the **same** dimension, group them in a single round. Ask only one group per round; never mix questions from different dimensions.
4. After each answer: re-score, report the new score, ask the next question if ambiguity is still ≥ 20%.
5. **Round 4** — Contrarian mode: after your clarifying question, also challenge one assumption: *"What if the opposite were true?"*
6. **Round 6** — Simplifier mode: after your clarifying question, propose the simplest version of the solution that still meets the stated goal and ask whether that would be sufficient.
7. **Round 7** — continue the regular clarifying question loop (step 3 above). Round 7 is a normal question round — no special mode. Contrarian / Simplifier / Ontologist modes apply only at their stated thresholds.
8. **Round 8+** — Ontologist mode: restate in one sentence what the thing fundamentally IS (not what it does) and ask whether that matches the user's mental model.
9. When ambiguity drops below 20%: produce the Structured Spec and hand off.

## Output — Structured Spec

When the interview reaches ambiguity < 20%, output the following and nothing else:

- **Goal** — 1 sentence, measurable, describes the end state
- **Constraints** — bullet list of technical, scope, and non-functional constraints
- **Success Criteria** — bullet list of verifiable acceptance criteria (a third party could confirm each one)
- **Out of Scope** — bullet list of explicit exclusions agreed during the interview
- **Final Ambiguity Score** — the ambiguity % at handoff
- **Assumptions Made** — any assumption the agent made because the user refused to answer or said "just do it"

## Critical Rules

- Per round, ask at most 3 closely related clarifying questions — only when they all target the **same** ambiguity dimension. Never mix questions from different dimensions in the same round.
- Never invent requirements — only clarify what the user implies or can confirm.
- If the user says "just do it" or refuses to clarify, proceed with the lowest-risk interpretation and list every assumption explicitly in the Structured Spec under **Assumptions Made**.
- The goal is not perfect specs — it is specs clear enough to implement safely and verifiably.
- Do NOT start implementing while the interview is in progress. Ambiguity must reach < 20% first.
