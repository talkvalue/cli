# TalkValue CLI

Manage your contacts, channels, events, and companies.

## Install

```bash
npm i -g @talkvalue/cli
```

Requires Node.js >= 24.

## Auth

```bash
talkvalue auth login               # browser-based login + org selection
talkvalue auth status              # current session
talkvalue auth switch [org]        # switch organization
talkvalue auth list                # list profiles
talkvalue auth logout              # remove profile
```

For CI, set `TALKVALUE_TOKEN`:

```bash
TALKVALUE_TOKEN="eyJ..." talkvalue path person list
```

## Commands

```bash
talkvalue path overview                                    # dashboard summary
talkvalue path overview stats                              # detailed stats

# People
talkvalue path person list                                 # list people
talkvalue path person list --event-id 16 --sort joinedAt:desc
talkvalue path person get <id>
talkvalue path person update <id> --name "…"
talkvalue path person delete <id> --confirm
talkvalue path person merge <sourceId> <targetId> --confirm
talkvalue path person merge-undo <mergeOperationId> --confirm
talkvalue path person activity <personId>
talkvalue path person export                               # CSV export

# Events
talkvalue path event list
talkvalue path event get <id>
talkvalue path event create --name "…" --start-at "…" --time-zone "…"
talkvalue path event update <id> --name "…" --start-at "…" --time-zone "…"
talkvalue path event delete <id> --confirm
talkvalue path event person list <eventId>
talkvalue path event person add <eventId> --email "…"
talkvalue path event person export <eventId>

# Channels
talkvalue path channel list
talkvalue path channel create --name "…"
talkvalue path channel update <id> --name "…"
talkvalue path channel delete <id> --confirm
talkvalue path channel people <channelId>
talkvalue path channel add-person <channelId> --email "…"
talkvalue path channel export <channelId>

# Companies
talkvalue path company list
talkvalue path company get <id>
talkvalue path company update <id> --display-name "…"
talkvalue path company person list <companyId>
talkvalue path company person export <companyId>

# Analysis
talkvalue path analysis channel attribution <channelId> --event-id <id>
talkvalue path analysis channel audience --channel-id <id> --channel-id <id>
talkvalue path analysis event insights
talkvalue path analysis event trend

# Import
talkvalue path import list
talkvalue path import get <id>
talkvalue path import create --file-key "…" --source-id <n> --mode UPDATE --mapping 0:EMAIL
talkvalue path import analyze --file ./data.csv
talkvalue path import failed-export <id>

# Config
talkvalue config list
talkvalue config set <key> <value>
talkvalue version
```

## Flags

```
--format <json|table|csv>   output format (default: table for TTY, json for pipe)
--json                      shorthand for --format json
--profile <name>            use specific profile
--no-color                  disable colored output
```

`--page`, `--page-size`, and `--sort` are available on list subcommands.

## Output

```jsonc
// Success
{ "data": { ... } }

// List (paginated)
{ "data": [...], "pagination": { "page": 0, "pageSize": 20, "totalElements": 100, "totalPages": 5 } }

// Error (stderr)
{ "error": { "message": "..." } }
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
