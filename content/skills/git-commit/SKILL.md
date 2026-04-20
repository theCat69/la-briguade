---
name: git-commit 
description: Stage and create commits using the repository message convention after implementation is complete; do not use for diff analysis or branch review.
version: 1.0.0
author: theCat69 
type: skill
category: development
tags:
  - git
  - commit
agents:
  - builder
  - orchestrator
---

# Git commit Skill

---

# Git commit skill Prerequisites

- Access to `git add` and `git commit` commands.

---

# Git commit message template 

- template:
```
<version> / <ai | human> / <purpose> : <what was done (briefly)>
```

- example:
```
1_1_0 / ai / implementing: feature-36-multi-parameter-integration-tests.md done. 
Adding multi parameter integration tests for search api to 
check multi parameters regressions in futur implementations.
```

---

## Git workflow 

When agents wants to commit here is the workflow :
- add files to index using `git add` command
- commit files using `git commit` command

---
