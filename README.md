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

- Node.js >= 22

## Authentication

```bash
talkvalue auth login
```

The CLI prints a one-time code and opens a verification URL in your browser. Complete the login to authenticate.

```bash
talkvalue auth status          # check current session
talkvalue auth logout          # clear session
talkvalue auth switch <profile> # switch org profile
```

For CI/CD, set `TALKVALUE_TOKEN` to skip interactive login:

```bash
TALKVALUE_TOKEN="eyJ..." talkvalue path person list
```

## Common Commands

```bash
talkvalue path overview                       # dashboard summary
talkvalue path person list --page-size 20     # list people
talkvalue path person get <id>                # person details
talkvalue path channel list                   # list channels
talkvalue path channel create --name "VIP"    # create channel
talkvalue path person export                  # CSV export
talkvalue config list                         # show config
talkvalue version                             # version info
```

## Global Flags

```
--format <json|table|csv>   output format (default: table for TTY, json for pipe)
--profile <name>            use specific org profile
--no-color                  disable colored output
-q, --quiet                 suppress non-essential output
-v, --verbose               enable verbose logging
--page <n>                  page number
--page-size <n>             page size
```

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

Config is stored at `~/.talkvalue/config.yml` (or `$XDG_CONFIG_HOME/talkvalue/`).

```bash
talkvalue config list
```

## License

ISC
