# TalkValue CLI

Manage your contacts and channels.

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
talkvalue path overview                        # dashboard summary

talkvalue path person list                     # list people
talkvalue path person list --event-id 16       # filter by event
talkvalue path person list --sort joinedAt:desc # sort by join date
talkvalue path person get <id>                 # person details
talkvalue path person update <id> --name "…"   # update
talkvalue path person delete <id> --confirm    # delete
talkvalue path person export                   # CSV export

talkvalue path channel list                    # list channels
talkvalue path channel create --name "VIP"     # create
talkvalue path channel update <id> --name "…"  # update
talkvalue path channel delete <id> --confirm   # delete

talkvalue config list                          # show config
talkvalue config set <key> <value>             # set value
talkvalue version                              # version info
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
