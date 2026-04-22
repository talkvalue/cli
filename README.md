<h1 align="center">TalkValue CLI</h1>

**Manage contacts, events, channels, companies, and analytics from the command line.**<br>
Built for humans and AI agents. Structured JSON output. 11 agent skills included.

<p>
  <a href="https://www.npmjs.com/package/@talkvalue/cli"><img src="https://img.shields.io/npm/v/@talkvalue/cli" alt="npm version"></a>
  <a href="https://github.com/talkvalue/cli/blob/main/LICENSE"><img src="https://img.shields.io/github/license/talkvalue/cli" alt="license"></a>
  <a href="https://github.com/talkvalue/cli/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/talkvalue/cli/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/@talkvalue/cli"><img src="https://img.shields.io/npm/unpacked-size/@talkvalue/cli" alt="install size"></a>
</p>
<br>

```bash
npm install -g @talkvalue/cli
```

## Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Why TalkValue CLI?](#why-talkvalue-cli)
- [Authentication](#authentication)
- [Commands](#commands)
- [AI Agent Skills](#ai-agent-skills)
- [Output Format](#output-format)
- [Pagination](#pagination)
- [Environment Variables](#environment-variables)
- [Exit Codes](#exit-codes)
- [License](#license)

## Prerequisites

- **Node.js 24+**
- **A TalkValue account** with at least one organization

## Quick Start

```bash
talkvalue auth login
talkvalue path person list
talkvalue path event person list 16 --sort joinedAt:desc --json
```

## Why TalkValue CLI?

**For humans** — stop clicking through the UI to export contacts or check event registrants. Get `--help` on every command, pipe output to `jq`, and script your workflows.

**For AI agents** — every response is structured JSON. Pair it with the included agent skills and your LLM can manage contacts, events, and imports without custom tooling.

```bash
# List people in a channel, sorted by join date
talkvalue path channel people 5 --sort joinedAt:desc --json

# Export event registrants to CSV
talkvalue path event person export 16 > registrants.csv

# Analyze a CSV before importing
talkvalue path import analyze --file contacts.csv --json

# Channel attribution across events
talkvalue path analysis channel attribution 3 --event-id 16 --event-id 22 --json
```

## Authentication

The CLI supports multiple auth workflows so it works on your laptop and in CI.

### Interactive (local desktop)

```bash
talkvalue auth login     # browser-based OAuth device flow; select organization
```

### CI / scripting

```bash
export TALKVALUE_TOKEN=<bearer-token>
talkvalue path person list    # just works
```

### Multi-profile support

Each profile stores `org_id`, `org_name`, `member_email`, and auth method. Use `auth switch` to change the active org, or `--profile <name>` to target a specific one.

| Command | Description |
|---------|-------------|
| `auth login` | Authenticate via OAuth device flow; select organization |
| `auth status` | Show current profile, email, org |
| `auth switch [org]` | Switch active organization |
| `auth list` | List all saved profiles |
| `auth logout` | Remove profile and credentials |

### Precedence

| Priority | Source | Set via |
|----------|--------|---------|
| 1 | Bearer token | `TALKVALUE_TOKEN` |
| 2 | OAuth profile | `talkvalue auth login` |

## Commands

All data commands live under the `path` prefix. Run `talkvalue [command] --help` for full usage.

| Command | Description |
|---------|-------------|
| `path overview` | Dashboard summary and stats (filter with `--tag-id`) |
| `path person` | List, get, update, delete, merge, export contacts |
| `path event` | Manage events and event participants |
| `path channel` | Manage channels and channel members |
| `path company` | List, get, update companies and company members |
| `path analysis` | Channel attribution, audience overlap, event trends (`--tag-id` filters) |
| `path import` | Analyze CSV, create import jobs, export failures |
| `path tag` | Create tags and attach them to channels or events |
| `version` | Show CLI version |

### Global Flags

| Flag | Description |
|------|-------------|
| `--format <json\|table\|csv>` | Output format (default: `table` for TTY, `json` for pipe) |
| `--json` | Shorthand for `--format json` |
| `--profile <name>` | Use a specific auth profile |
| `--api-url <url>` | API base URL override |
| `--no-color` | Disable colored output |

## AI Agent Skills

The repo ships 11 agent skills (`SKILL.md` files) — one for every command group, plus recipes for common workflows. Pair them with any AI coding assistant for structured CLI access to TalkValue.

```bash
# Install all skills at once
npx skills add https://github.com/talkvalue/cli

# Or pick only what you need
npx skills add https://github.com/talkvalue/cli/tree/main/skills/talkvalue-person
npx skills add https://github.com/talkvalue/cli/tree/main/skills/talkvalue-event
```

### Skills Index

| Skill | Description |
|-------|-------------|
| [talkvalue-shared](skills/talkvalue-shared/SKILL.md) | Auth, global flags, output format, environment variables |
| [talkvalue-person](skills/talkvalue-person/SKILL.md) | Manage contacts: list, get, update, delete, merge, export, activity |
| [talkvalue-event](skills/talkvalue-event/SKILL.md) | Manage events and event participants |
| [talkvalue-channel](skills/talkvalue-channel/SKILL.md) | Manage channels and channel members |
| [talkvalue-company](skills/talkvalue-company/SKILL.md) | View and manage companies |
| [talkvalue-analysis](skills/talkvalue-analysis/SKILL.md) | Channel attribution, audience overlap, event insights |
| [talkvalue-import](skills/talkvalue-import/SKILL.md) | CSV import: analyze, create jobs, monitor, export failures |
| [talkvalue-tag](skills/talkvalue-tag/SKILL.md) | Create tag labels and attach them to channels or events |

### Recipes

| Recipe | Description |
|--------|-------------|
| [recipe-new-registrants](skills/recipe-new-registrants/SKILL.md) | Find this month's event registrants |
| [recipe-csv-import](skills/recipe-csv-import/SKILL.md) | Full import workflow: analyze → create → monitor → export failures |
| [recipe-channel-analysis](skills/recipe-channel-analysis/SKILL.md) | Channel attribution + audience overlap analysis |

## Output Format

All output — success and errors — is structured JSON when piped. Format is auto-detected:

- **TTY** (terminal) → `table`
- **Pipe/redirect** → `json`
- Override with `--format <format>` or `--json`

```jsonc
{ "data": { ... } }                    // single resource
{ "data": [...], "pagination": {...} } // paginated list
```

Errors are written to stderr:

```jsonc
{ "error": { "message": "..." } }
```

Export commands (`person export`, `channel export`, etc.) always produce CSV regardless of `--format`.

## Pagination

| Flag | Description |
|------|-------------|
| `--page <n>` | Page number (1-indexed) |
| `--page-size <n>` | Results per page |
| `--sort <field:dir>` | Sort expression; repeatable (e.g. `joinedAt:desc`) |

`--page` and `--page-size` are available on all list subcommands. `--sort` is available on person, event person, channel people, and company person lists.

```bash
talkvalue path person list --page 2 --page-size 50 --sort joinedAt:desc
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TALKVALUE_TOKEN` | Bearer token — skips interactive auth (highest priority) |
| `TALKVALUE_API_URL` | API base URL override |
| `TALKVALUE_AUTH_API_URL` | Auth API base URL override |
| `TALKVALUE_PROFILE` | Active profile override |
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Usage error (bad arguments) |
| `3` | Authentication error |
| `4` | Not found |
| `5` | Forbidden |

```bash
talkvalue path person get 999999
echo $?   # 4 — not found
```

## License

ISC
