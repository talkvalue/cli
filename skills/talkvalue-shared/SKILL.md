---
name: talkvalue-shared
description: "Shared TalkValue CLI reference covering authentication, global flags, output formatting (json/table/csv), environment variables, and exit codes. Use when working with any TalkValue (`talkvalue`) command, configuring credentials or profiles, picking output format, or interpreting CLI exit codes."
---

# TalkValue CLI — Shared Reference

## Installation

```bash
npm install -g @talkvalue/cli
```

The `talkvalue` binary must be on `$PATH`.

## Authentication

```bash
# Browser-based OAuth (interactive)
talkvalue auth login

# Token-based (CI/scripting)
export TALKVALUE_TOKEN=<bearer-token>
```

### Auth Commands

| Command | Description |
|---------|-------------|
| `auth login` | Authenticate via OAuth device flow; select organization |
| `auth status` | Show current profile, email, org |
| `auth switch [org]` | Switch active organization |
| `auth list` | List all saved profiles |
| `auth logout` | Remove profile and credentials |

### Multi-Profile Support

The CLI supports multiple profiles. Each profile stores `org_id`, `org_name`, `member_email`, and auth method. Use `--profile <name>` to target a specific profile, or `auth switch` to change the active one.

## CLI Syntax

```bash
talkvalue <group> [subcommand] [arguments] [flags]
```

All data commands live under the `path` prefix:

```bash
talkvalue path <resource> <action> [arguments] [flags]
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--format <json\|table\|csv>` | Output format (default: `table` for TTY, `json` for pipe) |
| `--json` | Shorthand for `--format json` |
| `--profile <name>` | Use a specific auth profile |
| `--api-url <url>` | API base URL override |
| `--no-color` | Disable colored output |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TALKVALUE_TOKEN` | Bearer token — skips interactive auth (highest priority) |
| `TALKVALUE_API_URL` | API base URL override |
| `TALKVALUE_AUTH_API_URL` | Auth API base URL override |
| `TALKVALUE_PROFILE` | Active profile override |
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |

## Output Format

All commands produce structured output:

```json
{ "data": { ... } }                    // single resource
{ "data": [...], "pagination": {...} } // paginated list
```

Errors are written to stderr:

```json
{ "error": { "message": "..." } }
```

Format is auto-detected:
- **TTY** (terminal) → `table`
- **Pipe/redirect** → `json`
- Override with `--format <format>` or `--json`

Export commands (`person export`, `channel export`, etc.) always produce CSV regardless of `--format`.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Usage error (bad arguments) |
| `3` | Authentication error |
| `4` | Not found |
| `5` | Forbidden |

## Pagination

Paginated commands accept:

| Flag | Description |
|------|-------------|
| `--page <n>` | Page number (1-indexed) |
| `--page-size <n>` | Results per page |
| `--sort <field:dir>` | Sort expression (repeatable, e.g. `joinedAt:desc`) |

## Overview Dashboard

```bash
# Summary dashboard with diversification, growth, and retention metrics
talkvalue path overview [--timezone <tz>] [--tag-id <id>]

# Detailed statistics: top channels and event registration trends
talkvalue path overview stats [--timezone <tz>]
```

| Flag | Available on | Description |
|------|--------------|-------------|
| `--timezone <tz>` | `overview`, `overview stats` | IANA time zone for date bucketing (parent option; `stats` inherits) |
| `--tag-id <id>` | `overview` | Restrict the summary to events carrying this tag |

## Configuration (hidden)

```bash
talkvalue config get <key>
talkvalue config set <key> <value>   # api_url, client_id, active_profile
talkvalue config list
```

## Security Rules

- **Never** output tokens or credentials directly
- **Always** confirm with the user before executing delete or merge commands
- Use `--confirm` flag for destructive operations — the CLI requires it

## Version

```bash
talkvalue version   # → { version, nodeVersion, platform }
```
