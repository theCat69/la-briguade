---
name: frontend
description: Frontend verification workflow — HTML semantics, CSS architecture decisions, and browser-based verification using playwright-cli.
---

# Frontend Development Guidelines

## Verification Workflow

After any HTML/CSS/JS/TS change that affects the browser UI, verify structurally and visually.

### Step 1 — Open and inspect the DOM

```bash
playwright-cli open http://localhost:<port>
playwright-cli snapshot
```

`snapshot` returns the page accessibility tree as YAML with element refs (`e1`, `e2`, ...). Use refs to interact. This is the primary inspection tool — text-based and token-efficient.

### Step 2 — Check for console errors

```bash
playwright-cli console error
```

Zero errors is the baseline. Investigate and fix anything found before considering the work done.

### Step 3 — Run existing tests

Check `playwright.config.ts` or `playwright.config.js` for the test command, then run:

```bash
npx playwright test
```

Fix any failures before considering the work done.

### Step 4 — Visual inspection (when layout correctness matters)

```bash
playwright-cli screenshot --filename=page.png
```

Then use the `read` tool on `page.png` — Claude is vision-capable and can reason about layout from the screenshot.

---

## HTML Semantics Checklist

Use semantic HTML — it gives you accessibility for free and is always cheaper than ARIA.

- `<header>`, `<main>`, `<footer>`, `<nav>`, `<aside>`, `<section>`, `<article>` instead of generic `<div>`
- Headings in document order: `<h1>` → `<h2>` → `<h3>` — no skipping levels
- Interactive elements: `<button>` for actions, `<a href>` for navigation — never `<div onclick>`
- Forms: every `<input>` has a `<label>` (associated via `for`/`id` or by wrapping)
- Images: meaningful `<img>` has descriptive `alt="..."`, decorative images use `alt=""`
- Tables: `<th scope="col|row">` for header cells; `<caption>` for the table title

### ARIA — only when semantics fall short

- Use native elements first — ARIA is a last resort, not a starting point
- `role`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-hidden` — only when no semantic element expresses the intent
- Never use ARIA to re-describe what the browser already provides (e.g. `role="button"` on a `<button>` is noise)

---

## CSS Architecture Decisions

### Scoping strategy

- **Framework-managed scoping** (Angular `ViewEncapsulation`, CSS Modules, Vue scoped styles): prefer over global classes
- **Global CSS**: reserve for design tokens, resets, typography base, and utility classes only
- **BEM** (Block__Element--Modifier): use only when framework scoping is unavailable

### Layout

- Use **CSS Grid** for two-dimensional layouts; **Flexbox** for single-axis layouts
- Avoid `position: absolute` for layout — use it for overlays and decorative positioning
- Prefer `gap` over margin hacks for spacing within flex/grid containers

### Design tokens

- Define spacing, color, and typography as CSS custom properties: `--color-primary`, `--space-4`
- Never hardcode hex values or raw pixel sizes in component styles — always reference tokens

### Responsive design

- Mobile-first: base styles first, then `min-width` media queries for larger breakpoints
- Avoid fixed pixel widths for content containers — use `max-width` + `width: 100%`

---

## playwright-cli Reference

For full command reference — sessions, element targeting, network mocking, test generation, tracing — load skill `playwright-cli`.