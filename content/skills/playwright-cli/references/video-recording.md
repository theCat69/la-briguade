# Video Recording

Capture browser automation sessions as video for debugging, documentation, or verification. Produces WebM (VP8/VP9 codec).

## Basic Recording

```bash
playwright-cli open

playwright-cli video-start demo.webm
playwright-cli video-chapter "Getting Started" --description="Opening the homepage" --duration=2000

playwright-cli goto https://example.com
playwright-cli click e1

playwright-cli video-chapter "Filling Form" --description="Entering test data" --duration=2000
playwright-cli fill e2 "test input"

playwright-cli video-stop
```

## Best Practices

### Use Descriptive Filenames

```bash
playwright-cli video-start recordings/login-flow-2024-01-15.webm
```

### Record Entire Hero Scripts

For polished demo videos, create a script and run it with `run-code`. This allows precise pauses and annotations.

1. Perform the scenario with CLI and note all locators and actions
2. Create a script file with the sequence, using `pressSequentially` with delay for realistic typing
3. Run: `playwright-cli run-code --filename=your-script.js`

```js
async page => {
  await page.screencast.start({ path: 'video.webm', size: { width: 1280, height: 800 } });
  await page.goto('https://demo.playwright.dev/todomvc');

  await page.screencast.showChapter('Adding Todo Items', {
    description: 'We will add several items to the todo list.',
    duration: 2000,
  });

  await page.getByRole('textbox', { name: 'What needs to be done?' })
    .pressSequentially('Walk the dog', { delay: 60 });
  await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
  await page.waitForTimeout(1000);

  // Sticky annotation — pointer-events: none, does not block interactions
  const annotation = await page.screencast.showOverlay(`
    <div style="position: absolute; top: 8px; right: 8px;
      padding: 6px 12px; background: rgba(0,0,0,0.7);
      border-radius: 8px; font-size: 13px; color: white;">
      ✓ Item added successfully
    </div>
  `);

  await annotation.dispose();
  await page.screencast.stop();
}
```

**Important**: Overlays are `pointer-events: none` — they do not interfere with page interactions.

### Overlay API Summary

| Method | Use Case |
|--------|----------|
| `page.screencast.showChapter(title, { description?, duration? })` | Full-screen chapter card |
| `page.screencast.showOverlay(html, { duration? })` | Custom HTML overlay (callouts, labels, highlights) |
| `disposable.dispose()` | Remove a sticky overlay |