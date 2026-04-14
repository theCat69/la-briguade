# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Issue #9**: Skill MCP `environment` entries referencing unset env vars are now silently omitted
  instead of being included as empty strings with a warning. `command` elements and `headers` values
  retain the original warn-and-substitute behaviour.
- **Issue #10**: `la-briguade doctor` cache-ctrl availability check no longer requires `exit 0`,
  fixing a false-positive failure for tools that exit non-zero for `--version` (such as Bun-based CLIs).
