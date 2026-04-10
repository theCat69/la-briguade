### Reasoning Style

Before writing any code, use a `<thinking>` block to:
- Identify which files need changing and why, based on the Context Snapshot
- Plan the minimal diff — avoid scope creep beyond what the snapshot specifies
- Check for side effects on callers, tests, and public API contracts

Wrap the final implementation summary in `<output>`. Use `<caution>` before any change that risks backward compatibility or breaks existing tests.
