# TalkValue CLI

Command-line interface for TalkValue — manage your contacts and channels from the terminal.

## Install

```bash
npm i -g @talkvalue/cli
```

or run directly:

```bash
npx @talkvalue/cli --help
```

## Requirements

- Node.js >= 24

## Authentication

```bash
talkvalue auth login              # device code flow + org selection
talkvalue auth login --org "Acme" # skip interactive org selection
```

The CLI prints a one-time code and opens a verification URL in your browser. After login, select an organization to scope your session.

### Managing sessions

```bash
talkvalue auth status             # current session info
talkvalue auth switch [org]       # switch organization (interactive or by name/id)
talkvalue auth list               # list all profiles
talkvalue auth logout             # clear session
```

### CI/CD

Set `TALKVALUE_TOKEN` to skip interactive login:

```bash
TALKVALUE_TOKEN="eyJ..." talkvalue path person list
```

## Commands

```bash
# Overview
talkvalue path overview                       # dashboard summary

# People
talkvalue path person list --page-size 20     # list people
talkvalue path person get <id>                # person details
talkvalue path person update <id> --name "…"  # update person
talkvalue path person delete <id>             # delete person
talkvalue path person export                  # CSV export

# Channels
talkvalue path channel list                   # list channels
talkvalue path channel create --name "VIP"    # create channel
talkvalue path channel update <id> --name "…" # update channel
talkvalue path channel delete <id>            # delete channel

# Config
talkvalue config list                         # show config
talkvalue config get <key>                    # get value
talkvalue config set <key> <value>            # set value

# Version
talkvalue version                             # version info
```

## Global Flags

```
--format <json|table|csv>   output format (default: table for TTY, json for pipe)
--profile <name>            use specific profile
--api-url <url>             API base URL override
--no-color                  disable colored output
--page <n>                  page number
--page-size <n>             page size
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TALKVALUE_TOKEN` | Bearer token (skips interactive auth) |
| `TALKVALUE_API_URL` | API base URL override |
| `TALKVALUE_AUTH_API_URL` | Auth API base URL override |
| `TALKVALUE_PROFILE` | Active profile override |
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |
| `XDG_CONFIG_HOME` | Config directory base (default: `~/.config`) |

## Output Contract

Machine-readable output is intentionally lean.

Success:

```json
{
  "data": { }
}
```

Paginated:

```json
{
  "data": [],
  "pagination": { "page": 0, "pageSize": 20, "totalElements": 100, "totalPages": 5 }
}
```

Error:

```json
{
  "error": { "message": "Request failed with status 401" }
}
```

Exit codes: `0` success, `1` error, `2` usage, `3` auth, `4` not-found, `5` forbidden.

## Configuration

Config is stored at `~/.talkvalue/config.yml` (or `$XDG_CONFIG_HOME/talkvalue/`). File permissions are `0o600` (owner-only).

```bash
talkvalue config list
```

## License

ISC
