# la-briguade DSH persona visibility report

## Finding

The personas are not visible because the `web` DSH profile does not declare `la-briguade-dsh` as a profile bundle. The profile currently has an empty user patch and its `package.json` lists only:

- `@deepseek-ai/dsh-mcp-client@0.0.1-rc.1`
- `dsh-codex-provider@0.1.0`

The local `node_modules/la-briguade-dsh` symlink exists, but it is not a dependency and therefore is not included in DSH's bundle layer composition. A symlink alone is insufficient: DSH composes only the packages listed in `dsh.profile.bundles`, which are reconciled from installed dependencies declaring `dsh.bundle`.

## Evidence collected

- Installed launcher: `dsh 0.1.5-rc.1`.
- Web profile: `/home/fefou/.dsh/profiles/web`.
- `package.json` has no `la-briguade-dsh` dependency and its `dsh.profile.bundles` contains only the base/web bundles plus `dsh-codex-provider`.
- `/home/fefou/.dsh/profiles/web/cordis.patch.yml` is `[]`; it does not insert the la-briguade adapter or the `agent-presets` override.
- The profile's `node_modules/la-briguade-dsh` points to this checkout's `dsh/` directory, and the linked bundle itself is healthy: generated manifest contains 15 agents, including the four primary personas `ask`, `builder`, `orchestrator`, and `planner`, plus 11 specialists and 15 generated persona prompt files.
- The repository's DSH documentation explicitly requires installing the bundle with `dsh plugin --profile web add ./dsh` before starting `dsh web`.
- The repository's `dsh/cordis.patch.yml` provides the adapter insertion and `agent-presets` configuration, but that file is inside the plugin bundle and is never reached while the bundle is not mounted.

## Why this produces the symptom

`dsh/index.js` only registers the persona roster after its `apply()` function is invoked. The roster comes from `content/manifest.json`; the Web UI's selectable primary personas additionally require the host `agent-presets` service. Since the plugin bundle is absent from the profile's effective patch stack, `apply()` is never run and no la-briguade personas or presets are registered.

The linked files can make the installation look present on disk while having no runtime effect. This explains why the persona prompt files are visible in the checkout/link but not in the DSH UI.

## Contributing compatibility risk

The launcher is `0.1.5-rc.1`, while this bundle was developed and tested against DSH component packages `0.1.5-rc.2` (as documented in `DEEPSEEK.md` and `dsh/README.md`). Even after installing the bundle, this version skew may cause compatibility problems and should be eliminated or explicitly tested. It is not the primary cause observed here, because the current profile does not mount the plugin at all.

## Recommended recovery

From the la-briguade checkout, run:

```bash
npm run build:dsh
dsh plugin --profile web add ./dsh
dsh web
```

Then verify that the profile package manifest contains `la-briguade-dsh` under `dependencies` and under `dsh.profile.bundles`. Restart `dsh web` after installation. If the UI still has no presets, run the adapter's `la_briguade_status` command/tool and check that it reports the four primary personas and no persona-prompt diagnostics.

For a stable setup, use a DSH launcher/profile whose component versions match the bundle's tested `0.1.5-rc.2` family, or pin the bundle dependencies to the installed launcher's supported release after testing.

## Scope note

No source fix was required to explain this incident. The generated bundle and persona catalog are present and internally consistent; the failure is in machine-local DSH profile installation/activation.
