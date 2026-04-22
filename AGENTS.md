# AGENTS.md

## Overview

`talkvalue` is a CLI for the TalkValue platform — manage contacts, events, channels, companies, analysis, and data imports from the command line. Built for both humans and AI agents with structured JSON output.

## Quick Start

```bash
npm install -g @talkvalue/cli
talkvalue auth login
talkvalue path person list --json
```

## Authentication

```bash
# Interactive (OAuth device flow)
talkvalue auth login

# CI / scripting
export TALKVALUE_TOKEN=<bearer-token>
```

All data commands require authentication. The CLI supports multiple profiles — use `--profile <name>` to switch between organizations.

## AI Agent Skills

This repo includes agent skills for AI assistants. Each skill is a `SKILL.md` file with structured CLI reference documentation.

### Install Skills

```bash
# Install all skills
npx skills add https://github.com/talkvalue/cli

# Install specific skills
npx skills add https://github.com/talkvalue/cli/tree/main/skills/talkvalue-person
npx skills add https://github.com/talkvalue/cli/tree/main/skills/talkvalue-event
```

### Skills Index

#### Shared Reference

| Skill | Description |
|-------|-------------|
| [talkvalue-shared](skills/talkvalue-shared/SKILL.md) | Auth, global flags, output format, environment variables, exit codes |

#### Service Skills

| Skill | Description |
|-------|-------------|
| [talkvalue-person](skills/talkvalue-person/SKILL.md) | Manage contacts: list, get, update, delete, merge, export, activity |
| [talkvalue-event](skills/talkvalue-event/SKILL.md) | Manage events: CRUD, event people, export |
| [talkvalue-channel](skills/talkvalue-channel/SKILL.md) | Manage channels: CRUD, channel people, export |
| [talkvalue-company](skills/talkvalue-company/SKILL.md) | Manage companies: list, get, update, company people, export |
| [talkvalue-analysis](skills/talkvalue-analysis/SKILL.md) | Analytics: channel attribution, audience overlap, event insights and trends |
| [talkvalue-import](skills/talkvalue-import/SKILL.md) | CSV import: analyze, create jobs, monitor, export failures |
| [talkvalue-tag](skills/talkvalue-tag/SKILL.md) | Create tag labels and attach them to channels or events |

#### Recipe Skills

| Skill | Description |
|-------|-------------|
| [recipe-new-registrants](skills/recipe-new-registrants/SKILL.md) | Find this month's event registrants |
| [recipe-csv-import](skills/recipe-csv-import/SKILL.md) | Full CSV import workflow: analyze → create → monitor → export failures |
| [recipe-channel-analysis](skills/recipe-channel-analysis/SKILL.md) | Channel attribution + audience overlap analysis |

## Output Format

All commands produce structured JSON when piped:

```json
{ "data": { ... } }                    // single resource
{ "data": [...], "pagination": {...} } // paginated list
```

Use `--format json` or `--json` to force JSON output in a terminal.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Usage error |
| `3` | Auth error |
| `4` | Not found |
| `5` | Forbidden |
