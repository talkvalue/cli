---
name: talkvalue-tag
description: "Manages TalkValue tag labels and their attachments to channels or events: list/create/update/delete tags, attach or detach a tag from a source. Use when the user wants to create or rename tags, attach a tag to a channel or event, or organize sources so analytics can be filtered by tag (`--tag-id`)."
---

# TalkValue CLI — Tag

> **PREREQUISITE:** Read ../talkvalue-shared/SKILL.md for auth, global flags, and output formatting.

## Overview

Tags are reusable labels that can be attached to channels or events. They power the `--tag-id` filters on `path overview` and `path analysis` (event insights, event trend, channel attribution), letting you slice analytics by campaign, season, or any custom grouping.

```bash
talkvalue path tag <action> [arguments] [flags]
```

A "source" in this skill means either a **channel** or an **event** — both can carry tag attachments through the same endpoints.

## Commands

### `tag list`

List all tags in the active organization. Filter by name with `--name` (substring match, server-side).

```bash
talkvalue path tag list [--name <substring>]
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--name <substring>` | No | — | Server-side substring filter |

**Output:** Table — ID, Name

**Examples**

```bash
talkvalue path tag list
talkvalue path tag list --name vip
talkvalue path tag list --json | jq '.data[].id'
```

---

### `tag create`

Create a new tag.

```bash
talkvalue path tag create --name <name>
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `-n, --name <name>` | Yes | — | Tag name (must be unique within the org) |

**Output:** Created tag object (`{ id, name }`)

**Examples**

```bash
talkvalue path tag create --name "VIP"
talkvalue path tag create -n "Q3 Campaign" --json
```

---

### `tag update <id>`

Rename a tag. The backend uses **PUT semantics**, so `--name` is required.

```bash
talkvalue path tag update <id> --name <name>
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Tag ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--name <name>` | Yes | — | New tag name |

**Output:** Updated tag object

**Examples**

```bash
talkvalue path tag update 7 --name "VIP — 2026"
```

---

### `tag delete <id>`

Permanently delete a tag and detach it from every source.

> [!CAUTION]
> Destructive. Removes the tag from all attached channels and events. Requires `--confirm`.

```bash
talkvalue path tag delete <id> --confirm
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Tag ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--confirm` | Yes | — | Required acknowledgement for destructive operations |

**Output:** `{ "deleted": true, "id": <id> }`

**Examples**

```bash
talkvalue path tag delete 7 --confirm
```

---

### `tag attach <sourceId>`

Attach a tag to a source (channel or event). Pass `--tag-id` for an existing tag, or `--name` to attach a tag by name (the backend creates it if it does not exist). At least one of the two flags is required.

```bash
talkvalue path tag attach <sourceId> [--tag-id <id> | --name <name>]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<sourceId>` | Channel ID or event ID to attach the tag to |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--tag-id <id>` | One of | — | Existing tag ID to attach |
| `--name <name>` | One of | — | Tag name; backend creates it if missing |

**Output:** Resolved tag object

**Examples**

```bash
# Attach an existing tag by ID
talkvalue path tag attach 41 --tag-id 7

# Attach by name — creates the tag if it does not exist yet
talkvalue path tag attach 41 --name "Q3 Campaign"
```

---

### `tag detach <sourceId>`

Detach a tag from a source. Requires `--tag-id`.

```bash
talkvalue path tag detach <sourceId> --tag-id <id>
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<sourceId>` | Channel ID or event ID to detach the tag from |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--tag-id <id>` | Yes | — | Tag ID to detach |

**Output:** `{ "detached": true, "sourceId": <id>, "tagId": <id> }`

**Examples**

```bash
talkvalue path tag detach 41 --tag-id 7
```

---

## Tips

- **Source IDs are interchangeable:** `tag attach`/`tag detach` accept any channel ID or event ID. Use `channel list` / `event list` to find IDs.
- **Filter analytics by tag:** once a tag is attached to events, pass `--tag-id <id>` to `path overview`, `path analysis event insights`, `path analysis event trend`, or `path analysis channel attribution` to slice the results.
- **Tags appear inline:** `channel list` and `event list` show a `Tags` column with comma-separated tag names. Get full tag objects via `--json`.
- **Update is PUT, not PATCH:** `tag update` requires `--name`. To delete a tag entirely, use `tag delete`.

## See Also

- `../talkvalue-shared/SKILL.md` — Auth, global flags, output formatting
- `../talkvalue-channel/SKILL.md` — Channel CRUD; tagged channels appear in `channel list`
- `../talkvalue-event/SKILL.md` — Event CRUD; tagged events appear in `event list`
- `../talkvalue-analysis/SKILL.md` — `--tag-id` filters on attribution / insights / trend
