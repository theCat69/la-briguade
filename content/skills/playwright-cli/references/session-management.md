# Browser Session Management

Run multiple isolated browser sessions concurrently with state persistence.

## Named Browser Sessions

Use `-s` flag to isolate browser contexts:

```bash
# Browser 1: Authentication flow
playwright-cli -s=auth open https://app.example.com/login

# Browser 2: Public browsing (separate cookies, storage)
playwright-cli -s=public open https://example.com

# Commands are isolated by browser session
playwright-cli -s=auth fill e1 "user@example.com"
playwright-cli -s=public snapshot
```

## Session Commands

```bash
playwright-cli list
playwright-cli close                # stop the default browser
playwright-cli -s=mysession close   # stop a named browser
playwright-cli close-all
playwright-cli kill-all             # forcefully kill stale/zombie processes
playwright-cli delete-data
playwright-cli -s=mysession delete-data
```

## Environment Variable

```bash
export PLAYWRIGHT_CLI_SESSION="mysession"
playwright-cli open example.com  # Uses "mysession" automatically
```

## Common Patterns

### A/B Testing Sessions

```bash
playwright-cli -s=variant-a open "https://app.com?variant=a"
playwright-cli -s=variant-b open "https://app.com?variant=b"

playwright-cli -s=variant-a screenshot --filename=variant-a.png
playwright-cli -s=variant-b screenshot --filename=variant-b.png
```

### Persistent Profile

```bash
# Use persistent profile (auto-generated location)
playwright-cli open https://example.com --persistent

# Use persistent profile with custom directory
playwright-cli open https://example.com --profile=/path/to/profile
```

## Best Practices

- Name sessions semantically: `-s=github-auth`, `-s=docs-scrape`
- Always clean up: `playwright-cli close-all` or per-session `close`
- Delete stale data: `playwright-cli -s=oldsession delete-data`