<!-- Pattern: auto-inject-prompt-wrapping — Append auto-inject skills as wrapped blocks, or use raw body when prompt is empty -->

```typescript
function injectAutoInjectSkill(
  existingPrompt: string | undefined,
  skillName: string,
  description: string | undefined,
  body: string,
): string {
  const normalizedBody = body.trim();
  if (normalizedBody.length === 0) {
    return existingPrompt ?? ""; // skip empty skill bodies
  }

  if (!existingPrompt || existingPrompt.trim().length === 0) {
    return normalizedBody; // no existing prompt: inject raw body only
  }

  const wrappedBlock = [
    "---",
    `#${skillName}`,
    description?.trim() ?? "", // description line may be blank
    normalizedBody,
    "---",
  ].join("\n");

  return `${existingPrompt}\n\n${wrappedBlock}`; // append wrapped block to existing prompt
}
```
