# TalkValue CLI

Command-line interface for TalkValue Path — manage contacts, channels, events, companies, and analytics.

## Install

```bash
npm i -g @talkvalue/cli
```

Requires Node.js >= 24.

## Quick Start

```bash
talkvalue auth login
talkvalue path person list
talkvalue path event person list 16 --sort joinedAt:desc --format json
```

For CI/agents, set `TALKVALUE_TOKEN` to skip interactive login.

## Commands

Use `talkvalue [command] --help` for full usage of any command.

| Command | Description |
|---------|-------------|
| `auth login` | Browser-based login with org selection |
| `auth status` | Show current session |
| `auth switch` | Switch organization |
| `auth list` | List all profiles |
| `auth logout` | Remove profile and credentials |
| `path overview` | Dashboard summary and stats |
| `path person` | List, get, update, delete, merge, export people |
| `path event` | Manage events and event participants |
| `path channel` | Manage channels and channel members |
| `path company` | List, get, update companies and company members |
| `path analysis` | Channel attribution, audience overlap, event trends |
| `path import` | Analyze CSV, create import jobs, export failures |
| `version` | Show CLI version |

## Flags

| Flag | Description |
|------|-------------|
| `--format <json\|table\|csv>` | Output format (default: table for TTY, json for pipe) |
| `--json` | Shorthand for `--format json` |
| `--profile <name>` | Use a specific profile |
| `--no-color` | Disable colored output |

`--page` and `--page-size` are available on list subcommands. `--sort` is available on person and event person lists.

## Output

Data goes to stdout, errors go to stderr.

```jsonc
{ "data": { ... } }                    // single resource
{ "data": [...], "pagination": {...} }  // paginated list
{ "error": { "message": "..." } }      // error (stderr)
```

Exit codes: `0` success · `1` error · `2` usage · `3` auth · `4` not-found · `5` forbidden

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TALKVALUE_TOKEN` | Bearer token (skips interactive auth) |
| `TALKVALUE_API_URL` | API base URL override |
| `TALKVALUE_PROFILE` | Active profile override |
| `NO_COLOR` | Disable colored output |

## License

ISC
