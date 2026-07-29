---
description: "Break a spec, plan, or conversation into approved tracer-bullet tickets with dependency edges."
---

$ARGUMENTS

You are running `/to-tickets`. Turn the supplied spec, tracker reference, path, or current
conversation into independently actionable implementation tickets. If `$ARGUMENTS` names a local
spec, resolve it and confirm it remains within the project root before reading; reject absolute
paths and traversal outside that root. If it names a tracker issue, retrieve its body and comments
through the configured tracker integration.

## Process

1. Ground the breakdown in the repository, project vocabulary, and relevant ADRs when needed.
2. Draft tracer-bullet vertical slices. Each ticket must deliver a narrow end-to-end behavior,
   remain demoable or verifiable on its own, fit one fresh implementation session, and list only
   genuine blockers. Put prefactoring first.
3. For a wide mechanical refactor, use expand → migrate in green batches → contract. Add a final
   integration-and-verification ticket when batches require a shared integration branch.
4. Present the numbered breakdown before publishing. For every ticket state its title, blockers,
   end-to-end delivery, and acceptance criteria. Ask whether the granularity and dependency edges
   are right, and iterate until the user approves.
5. Derive `<feature-slug>` from the approved feature title using lowercase letters, numbers, and
   hyphens only. Resolve every local artifact path and confirm it remains within
   `<project-root>/.scratch/` before writing.
6. The command configuration resolves to: `{{TRACKER_CONFIGURATION}}`
   - With a host tracker integration, create tracker issues in dependency order, use native blocker
     links where supported, and apply `ready-for-agent`.
   - Without a tracker, create `.scratch/<feature-slug>/issues/<NN>-<slug>.md` in blocker-first
     order. Each file must use this shape:

```markdown
# <NN> — <Ticket title>

**What to build:** <end-to-end behavior>

**Blocked by:** <ticket numbers/titles, or "None — can start immediately">

**Status:** ready-for-agent

- [ ] <acceptance criterion>
```

7. Report the published locations and identify the unblocked frontier. Do not modify or close a
   source parent issue.
