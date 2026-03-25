---
name: talkvalue-analysis
description: "Channel attribution, audience overlap, and event analytics."
metadata:
  version: 1.0.0
  openclaw:
    category: "productivity"
    requires:
      bins:
        - talkvalue
    cliHelp: "talkvalue path analysis --help"
---

# TalkValue CLI — Analysis

> **PREREQUISITE:** Read ../talkvalue-shared/SKILL.md for auth, global flags, and output formatting.

## Overview

The `analysis` group provides read-only signals across channels and events: attribution modeling, audience overlap, event insight signals, and participant registration trends. All commands are read-only.

```bash
talkvalue path analysis <group> <action> [arguments] [flags]
```

---

## Channel Commands

### `analysis channel attribution`

Analyze how a channel contributed to event attendance for one or more events.

```bash
talkvalue path analysis channel attribution <channelId> --event-id <id> [--event-id <id> ...]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<channelId>` | ID of the channel to analyze |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--event-id <id>` | Yes (repeatable, min 1) | — | Event ID to include in attribution. Repeat for each event. |

**Output:** Attribution analysis object

**Examples**

```bash
# Single event
talkvalue path analysis channel attribution chan_abc123 --event-id evt_111

# Multiple events
talkvalue path analysis channel attribution chan_abc123 \
  --event-id evt_111 \
  --event-id evt_222 \
  --event-id evt_333

# JSON output for scripting
talkvalue path analysis channel attribution chan_abc123 \
  --event-id evt_111 --json
```

---

### `analysis channel audience`

Analyze the audience overlap between two to five channels.

```bash
talkvalue path analysis channel audience --channel-id <id> --channel-id <id> [--channel-id <id> ...]
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--channel-id <id>` | Yes (repeatable, min 2, max 5) | — | Channel ID to include. Pass at least 2, at most 5. |

**Output:** Audience overlap analysis object

**Examples**

```bash
# Two channels
talkvalue path analysis channel audience \
  --channel-id chan_abc123 \
  --channel-id chan_def456

# Five channels
talkvalue path analysis channel audience \
  --channel-id chan_abc123 \
  --channel-id chan_def456 \
  --channel-id chan_ghi789 \
  --channel-id chan_jkl012 \
  --channel-id chan_mno345
```

---

## Event Commands

### `analysis event insights`

Get event insight signals for the active organization. No flags accepted.

```bash
talkvalue path analysis event insights
```

**Output:** Event insights object

**Examples**

```bash
talkvalue path analysis event insights
talkvalue path analysis event insights --json
```

---

### `analysis event trend`

Get participant registration trend data for the active organization. No flags accepted.

```bash
talkvalue path analysis event trend
```

**Output:** Event trend data object

**Examples**

```bash
talkvalue path analysis event trend
talkvalue path analysis event trend --json
```

---

## Tips

- Attribution requires at least one `--event-id`. The CLI returns a usage error if none are supplied.
- Audience overlap accepts 2 to 5 channels. Passing 1 or more than 5 returns a usage error.
- Both event commands (`insights`, `trend`) are scoped to the active organization. Use `--profile` or `auth switch` to target a different org.
- Pipe output to `jq` for field extraction: `talkvalue path analysis event trend --json | jq '.data'`

## See Also

- `../talkvalue-shared/SKILL.md` — Auth, global flags, output formats, exit codes
- `../talkvalue-import/SKILL.md` — Import contacts into channels that feed attribution
