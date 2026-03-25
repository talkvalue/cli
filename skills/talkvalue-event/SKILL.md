---
name: talkvalue-event
description: "Manage events and event participants."
metadata:
  version: 1.2.2
  openclaw:
    category: "productivity"
    requires:
      bins:
        - talkvalue
    cliHelp: "talkvalue path event --help"
---

# TalkValue CLI — Event

> **PREREQUISITE:** Read ../talkvalue-shared/SKILL.md for auth, global flags, and output formatting.

## Overview

Manage events and their participants in TalkValue. All commands run under the `path event` subgroup.

```bash
talkvalue path event <action> [arguments] [flags]
```

## Commands

### `event list`

List all events in the organization.

```bash
talkvalue path event list
```

No flags.

**Output:** Table — ID, Name, Time Zone, Start At, Location, People (count), Created At

**Examples**

```bash
talkvalue path event list
talkvalue path event list --json
```

---

### `event get <id>`

Get full details for a single event.

```bash
talkvalue path event get <id>
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Event ID |

**Output:** Event object

**Examples**

```bash
talkvalue path event get 99
talkvalue path event get 99 --json
```

---

### `event create`

Create a new event. Name, start time, and time zone are required.

```bash
talkvalue path event create --name <name> --start-at <startAt> --time-zone <timeZone> [flags]
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `-n, --name <name>` | Yes | — | Event name |
| `--start-at <startAt>` | Yes | — | Start date/time (ISO 8601) |
| `--time-zone <timeZone>` | Yes | — | IANA time zone identifier (e.g. `America/New_York`) |
| `--end-at <endAt>` | No | — | End date/time (ISO 8601) |
| `--location <location>` | No | — | Physical or virtual location |

**Output:** Created event object

**Examples**

```bash
# Minimal create
talkvalue path event create \
  --name "Q3 Product Summit" \
  --start-at "2026-09-15T09:00:00" \
  --time-zone "America/Chicago"

# Full create with end time and location
talkvalue path event create \
  --name "Q3 Product Summit" \
  --start-at "2026-09-15T09:00:00" \
  --time-zone "America/Chicago" \
  --end-at "2026-09-15T18:00:00" \
  --location "Chicago Convention Center"
```

---

### `event update <id>`

Update one or more fields on an event. Only supplied flags are changed; omitted fields remain untouched.

```bash
talkvalue path event update <id> [flags]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Event ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--name <name>` | No | — | Event name |
| `--start-at <startAt>` | No | — | Start date/time (ISO 8601) |
| `--time-zone <timeZone>` | No | — | IANA time zone identifier |
| `--end-at <endAt>` | No | — | End date/time (ISO 8601) |
| `--location <location>` | No | — | Physical or virtual location |

**Output:** Updated event object

**Examples**

```bash
# Move to a virtual venue
talkvalue path event update 99 --location "Online (Zoom)"

# Extend the end time
talkvalue path event update 99 --end-at "2026-09-16T18:00:00"

# Rename and update time zone
talkvalue path event update 99 --name "Q3 Summit (APAC)" --time-zone "Asia/Tokyo"
```

---

### `event delete <id>`

Delete an event permanently.

> [!CAUTION]
> This is a **destructive** command — confirm with the user before executing. Requires `--confirm` flag.

```bash
talkvalue path event delete <id> --confirm
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Event ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--confirm` | Yes | — | Required acknowledgment for destructive operations |

**Output:** `{ deleted: true, id }`

**Examples**

```bash
talkvalue path event delete 99 --confirm
```

---

### `event person list <eventId>`

List people registered or associated with a specific event.

```bash
talkvalue path event person list <eventId> [flags]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<eventId>` | Event ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--keyword <keyword>` | No | — | Filter by name or email keyword |
| `--channel-id <id>` | No | — | Filter by channel ID (repeatable) |
| `--company-id <id>` | No | — | Filter by company ID |
| `--company-name <name>` | No | — | Filter by company name |
| `--job-title <title>` | No | — | Filter by job title |
| `--page <n>` | No | `1` | Page number |
| `--page-size <n>` | No | `20` | Results per page |
| `--sort <field:dir>` | No | — | Sort expression (repeatable, e.g. `joinedAt:desc`) |

**Output:** Paginated table — ID, Name, Primary Email, Company, Job Title, Joined At, Created At

**Examples**

```bash
# List all attendees of event 99
talkvalue path event person list 99

# Filter by company, sorted newest first
talkvalue path event person list 99 --company-name "Acme Corp" --sort joinedAt:desc

# Filter across multiple channels
talkvalue path event person list 99 --channel-id 10 --channel-id 11

# Search by keyword with pagination
talkvalue path event person list 99 --keyword "bob" --page 2 --page-size 25
```

---

### `event person add <eventId>`

Add a person to an event. Creates a new person record if none exists for the given email; otherwise links the existing record to the event and applies any supplied field updates.

```bash
talkvalue path event person add <eventId> --email <email> [flags]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<eventId>` | Event ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `-e, --email <email>` | Yes | — | Person's email address (used as unique identifier) |
| `--first-name <name>` | No | — | First name |
| `--last-name <name>` | No | — | Last name |
| `--phone <phone>` | No | — | Phone number (repeatable) |
| `--company-name <name>` | No | — | Company name |
| `--job-title <title>` | No | — | Job title |
| `--address <address>` | No | — | Mailing address |
| `--avatar-url <url>` | No | — | Avatar image URL |
| `--linkedin-url <url>` | No | — | LinkedIn profile URL |
| `--x-url <url>` | No | — | X (Twitter) profile URL |
| `--joined-at <timestamp>` | No | — | Timestamp of when they joined the event (ISO 8601) |

**Output:** Created person object

**Examples**

```bash
# Minimal add — email is the only required field
talkvalue path event person add 99 --email "bob@example.com"

# Full registration with profile details
talkvalue path event person add 99 \
  --email "bob@example.com" \
  --first-name "Bob" \
  --last-name "Smith" \
  --company-name "Widgets Inc" \
  --job-title "VP Sales" \
  --joined-at "2026-09-15T09:05:00"

# Add with multiple phone numbers
talkvalue path event person add 99 \
  --email "carol@example.com" \
  --phone "+1-555-0100" \
  --phone "+1-555-0101"
```

---

### `event person export <eventId>`

Export all people in an event as a CSV file.

```bash
talkvalue path event person export <eventId>
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<eventId>` | Event ID |

No flags. Output is always CSV regardless of `--format`.

**Examples**

```bash
# Export to file
talkvalue path event person export 99 > event-99-attendees.csv

# Export and count rows
talkvalue path event person export 99 | wc -l
```

---

## Tips

- **Required fields on create:** `--name`, `--start-at`, and `--time-zone` are all mandatory. The CLI errors without them.
- **Time zones:** Use IANA identifiers (`America/New_York`, `Europe/London`, `Asia/Tokyo`). Abbreviations like `EST` or `PST` are ambiguous and may be rejected.
- **ISO 8601 timestamps:** `--start-at`, `--end-at`, and `--joined-at` all accept ISO 8601 format, e.g. `2026-09-15T09:00:00` or `2026-09-15T09:00:00Z`.
- **Adding existing contacts:** `event person add` matches on email. If the address already exists in the org, the existing record is linked to the event and any supplied fields are updated.
- **Export pipeline:** `event person export` always produces CSV. Pipe directly into tools like `csvkit` or a spreadsheet importer — `--format` has no effect here.
- **Bulk channel filtering:** `--channel-id` on `event person list` is repeatable. Pass it multiple times to filter across several channels at once.

## See Also

- `../talkvalue-shared/SKILL.md` — Auth, global flags, output format, exit codes
- `../talkvalue-person/SKILL.md` — General contact management (list, update, merge, activity)
- `../talkvalue-company/SKILL.md` — Company management
- `../talkvalue-channel/SKILL.md` — Channel management
