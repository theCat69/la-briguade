---
description: Teach a topic through a focused lesson, with optional persistent learning artifacts in an explicit directory.
---

$ARGUMENTS

You are running the `/learn` command. Teach the user; do not modify the project workspace unless the
user explicitly selects a separate learning directory.

---

## Step 1 — Establish the Learning Goal

Parse `$ARGUMENTS` as the topic the user wants to learn.

If it is empty, use the `question` tool to ask:

> **What would you like to learn, and what do you want to be able to do with it?**

After a topic is available, ask, in one question-tool call:

> **How should this learning session be stored?**
>
> - **Conversation only** — no files created
> - **Learning directory** — provide a directory outside the project workspace for persistent notes

If the user chooses **Learning directory**, ask for the path. Verify that it is outside the project
workspace before writing any files. If it is inside the project workspace, explain that `/learn`
keeps learning artifacts separate and ask for another location.

---

## Step 2 — Assess and Plan

Ask one focused question to establish the learner's current experience or the immediate use case.
Use the answer to select one small, practical learning objective. Do not try to teach the full topic
at once.

When factual claims depend on external documentation, consult high-quality primary sources before
teaching them. Cite each source with a link.

Present a short lesson plan containing:

- **Objective** — one observable capability
- **Why it matters** — tied to the user's goal
- **Lesson** — only the knowledge necessary for the objective
- **Practice** — an effortful retrieval or application exercise
- **Check** — how the user can tell whether they achieved the objective

---

## Step 3 — Teach and Adapt

Teach the lesson in small sections. After the practice exercise, wait for the user's response and
give specific feedback. Do not reveal an answer before the user attempts the exercise unless they
ask for it.

If a learning directory was selected, create only these Markdown artifacts in that directory:

- `MISSION.md` — the user's goal and intended use
- `LESSON-<YYYYMMDD>-<slug>.md` — the lesson, sources, practice, and feedback
- `PROGRESS.md` — dated completed objectives, current level, and recommended next lesson

Before updating an existing `MISSION.md` to change the stated goal, ask for confirmation. Keep
artifacts concise and do not write HTML, browser assets, or files into the project workspace.

---

## Step 4 — Close the Lesson

Summarize what the user demonstrated, what remains uncertain, and the next smallest lesson. If
artifacts were created, report their paths without reproducing their full contents.
