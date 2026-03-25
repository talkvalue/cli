---
name: talkvalue-person
description: "Manage contacts: list, get, update, delete, merge, export, activity."
metadata:
  version: 1.0.0
  openclaw:
    category: "productivity"
    requires:
      bins:
        - talkvalue
    cliHelp: "talkvalue path person --help"
---

# TalkValue CLI — Person

> **PREREQUISITE:** Read ../talkvalue-shared/SKILL.md for auth, global flags, and output formatting.

## Overview

Manage contacts in TalkValue. All commands run under the `path person` subgroup.

```bash
talkvalue path person <action> [arguments] [flags]
```

## Commands

### `person list`

List all people in the organization.

```bash
talkvalue path person list [flags]
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--keyword <keyword>` | No | — | Filter by name or email keyword |
| `--channel-id <id>` | No | — | Filter by channel ID (repeatable) |
| `--event-id <id>` | No | — | Filter by event ID (repeatable) |
| `--company-id <id>` | No | — | Filter by company ID |
| `--company-name <name>` | No | — | Filter by company name |
| `--job-title <title>` | No | — | Filter by job title |
| `--page <n>` | No | `1` | Page number |
| `--page-size <n>` | No | `20` | Results per page |
| `--sort <field:dir>` | No | — | Sort expression (repeatable, e.g. `joinedAt:desc`) |

**Output:** Paginated table — ID, Name, Primary Email, Company, Job Title, Joined At, Created At

**Examples**

```bash
# List all people, newest first
talkvalue path person list --sort joinedAt:desc

# Filter by event and company
talkvalue path person list --event-id 42 --company-name "Acme Corp"

# Search by keyword, page 2
talkvalue path person list --keyword "alice" --page 2 --page-size 50

# Filter across multiple channels
talkvalue path person list --channel-id 10 --channel-id 11 --sort createdAt:asc
```

---

### `person get <id>`

Get full details for a single person.

```bash
talkvalue path person get <id>
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Numeric person ID |

**Output:** Full person object

**Examples**

```bash
talkvalue path person get 1234
talkvalue path person get 1234 --json
```

---

### `person update <id>`

Update one or more fields on a person record. Only supplied flags are changed; omitted fields remain untouched.

```bash
talkvalue path person update <id> [flags]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Numeric person ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--first-name <name>` | No | — | First name |
| `--last-name <name>` | No | — | Last name |
| `--primary-email <email>` | No | — | Primary email address |
| `--email <email>` | No | — | Additional email address (repeatable) |
| `--primary-phone <phone>` | No | — | Primary phone number |
| `--phone <phone>` | No | — | Additional phone number (repeatable) |
| `--job-title <title>` | No | — | Job title |
| `--address <address>` | No | — | Mailing address |
| `--avatar-url <url>` | No | — | Avatar image URL |
| `--linkedin-url <url>` | No | — | LinkedIn profile URL |
| `--x-url <url>` | No | — | X (Twitter) profile URL |
| `--company-name <name>` | No | — | Company name |

**Output:** Updated person object

**Examples**

```bash
# Update job title and company
talkvalue path person update 1234 --job-title "CTO" --company-name "Acme Corp"

# Add a secondary email address
talkvalue path person update 1234 --email "alice.backup@example.com"

# Update social profiles
talkvalue path person update 1234 \
  --linkedin-url "https://linkedin.com/in/alice" \
  --x-url "https://x.com/alice"
```

---

### `person delete <id>`

Delete a person permanently.

> [!CAUTION]
> This is a **destructive** command — confirm with the user before executing. Requires `--confirm` flag.

```bash
talkvalue path person delete <id> --confirm
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Numeric person ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--confirm` | Yes | — | Required acknowledgment for destructive operations |

**Output:** `{ deleted: true, id }`

**Examples**

```bash
talkvalue path person delete 1234 --confirm
```

---

### `person merge <sourceId> <targetId>`

Merge a source person into a target person. The source record is absorbed into the target and removed.

> [!CAUTION]
> This is a **destructive** command — confirm with the user before executing. Requires `--confirm` flag.

```bash
talkvalue path person merge <sourceId> <targetId> --confirm
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<sourceId>` | ID of the person to merge from (will be removed) |
| `<targetId>` | ID of the person to merge into (will be kept) |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--confirm` | Yes | — | Required acknowledgment for destructive operations |

**Output:** Merged person object

**Examples**

```bash
# Merge person 5678 into person 1234; 5678 is removed
talkvalue path person merge 5678 1234 --confirm
```

---

### `person merge-undo <mergeOperationId>`

Undo a previous merge operation, restoring the source person.

> [!CAUTION]
> This is a **destructive** command — confirm with the user before executing. Requires `--confirm` flag.

```bash
talkvalue path person merge-undo <mergeOperationId> --confirm
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<mergeOperationId>` | ID of the merge operation to reverse |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--confirm` | Yes | — | Required acknowledgment for destructive operations |

**Output:** `{ undone: true, mergeOperationId }`

**Examples**

```bash
talkvalue path person merge-undo op_abc123 --confirm
```

---

### `person export`

Export all people in the organization as a CSV file.

```bash
talkvalue path person export
```

No flags. Output is always CSV regardless of `--format`.

**Examples**

```bash
# Export to file
talkvalue path person export > people.csv

# Export and inspect first rows
talkvalue path person export | head -5
```

---

### `person activity <personId>`

View the activity history for a specific person.

```bash
talkvalue path person activity <personId> [flags]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<personId>` | Numeric person ID |

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--cursor <n>` | No | — | Pagination cursor for the next page |
| `--page-size <n>` | No | — | Number of results per page |

**Output:** Table — ID, Action, Actor, Created At

**Examples**

```bash
talkvalue path person activity 1234
talkvalue path person activity 1234 --page-size 50
```

---

## Tips

- **Bulk filtering:** `--channel-id` and `--event-id` are both repeatable. Pass each flag multiple times to filter across several channels or events in a single request.
- **Sorting:** `--sort` is repeatable. Chain expressions to apply a secondary sort: `--sort joinedAt:desc --sort createdAt:asc`.
- **Merge direction:** Order matters. `merge <source> <target>` removes the source. Run `person get` on both IDs to verify which is which before executing.
- **Undo window:** `merge-undo` only works within a limited window after the original merge. Capture the `mergeOperationId` from the merge output if you anticipate needing to reverse it.
- **Export pipeline:** `person export` always produces CSV. Pipe directly into tools like `csvkit`, `awk`, or a spreadsheet importer — `--format` has no effect here.
- **Scripting deletes:** Surface the delete command to the user for review before running it. The CLI enforces `--confirm`, but users should see exactly what will be deleted.

## See Also

- `../talkvalue-shared/SKILL.md` — Auth, global flags, output format, exit codes
- `../talkvalue-event/SKILL.md` — Events and event participant management
- `../talkvalue-company/SKILL.md` — Company management
- `../talkvalue-channel/SKILL.md` — Channel management
