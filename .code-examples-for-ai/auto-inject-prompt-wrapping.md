<!-- Pattern: auto-inject-prompt-wrapping — Append auto-inject skills as one grouped wrapped block; for empty prompts keep first body raw then group remaining skills -->

```typescript
function injectAutoInjectSkills(
  existingPrompt: string | undefined,
  entries: Array<{ skillName: string; description: string; body: string }>,
): string {
  const nonEmptyEntries = entries
    .map((entry) => ({ ...entry, body: entry.body.trim() }))
    .filter((entry) => entry.body.length > 0);

  if (nonEmptyEntries.length === 0) {
    return existingPrompt ?? ""; // skip empty skill bodies
  }

  const buildGroupedWrappedBlock = (
    groupedEntries: Array<{ skillName: string; description: string; body: string }>,
  ): string => {
    const skillSections = groupedEntries
      .map((entry) => `#${entry.skillName}\n${entry.description}\n${entry.body}`)
      .join("\n\n");

    return [
      "---",
      "AUTO-INJECTED-SKILLS-START",
      "The following content is already-loaded auto-injected skills. Each skill is shown as '#skill-name', then description, then body.",
      "",
      skillSections,
      "AUTO-INJECTED-SKILLS-END",
      "---",
    ].join("\n");
  };

  if (!existingPrompt || existingPrompt.trim().length === 0) {
    const [firstEntry, ...remainingEntries] = nonEmptyEntries;
    if (firstEntry == null) {
      return "";
    }

    const groupedRemainder =
      remainingEntries.length > 0 ? `\n\n${buildGroupedWrappedBlock(remainingEntries)}` : "";

    return `${firstEntry.body}${groupedRemainder}`;
  }

  const wrappedBlock = buildGroupedWrappedBlock(nonEmptyEntries);

  return `${existingPrompt}\n\n${wrappedBlock}`; // append one grouped wrapped block
}
```
