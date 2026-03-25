---
name: talkvalue-channel
description: "Manage marketing channels and channel members."
metadata:
  version: 1.2.2
  openclaw:
    category: "productivity"
    requires:
      bins:
        - talkvalue
    cliHelp: "talkvalue path channel --help"
---

# TalkValue CLI — Channels

> **PREREQUISITE:** Read ../talkvalue-shared/SKILL.md for auth, global flags, and output formatting.

Channels are named segments that group people for targeting and audience management. Each channel has an optional icon, a color, and its own member list.

## channel list

List all channels in the active organization.

```bash
talkvalue path channel list
```

No flags.

Output columns: ID, Name, Icon, Color, People (count), Created At

### Example

```bash
talkvalue path channel list
talkvalue path channel list --format json
talkvalue path channel list --json | jq '.[].name'
```

---

## channel get

Get details for a single channel.

```bash
talkvalue path channel get <id>
```

No flags.

### Example

```bash
talkvalue path channel get ch_01abc123
talkvalue path channel get ch_01abc123 --format json
```

---

## channel create

Create a new channel.

```bash
talkvalue path channel create --name <name> [flags]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `-n`, `--name <name>` | Yes | - | Display name for the channel |
| `--icon <icon>` | No | - | Icon identifier |
| `--color <color>` | No | - | Hex color code or named color |

Output: Created channel object.

### Example

```bash
talkvalue path channel create --name "Newsletter Subscribers"
talkvalue path channel create --name "VIP Members" --icon star --color "#FFD700"
talkvalue path channel create -n "Early Access" --color blue
```

---

## channel update

Update an existing channel's metadata.

```bash
talkvalue path channel update <id> [flags]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--name <name>` | No | - | New display name |
| `--icon <icon>` | No | - | New icon identifier |
| `--color <color>` | No | - | New hex color code or named color |

Output: Updated channel object.

### Example

```bash
talkvalue path channel update ch_01abc123 --name "Paying Customers"
talkvalue path channel update ch_01abc123 --color "#0055FF" --icon bolt
talkvalue path channel update ch_01abc123 --name "Premium" --icon crown --color "#C0C0C0"
```

---

## channel delete

> [!CAUTION]
> Permanently deletes the channel and removes all member associations. This action cannot be undone. You must pass `--confirm` to proceed.

```bash
talkvalue path channel delete <id> --confirm
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--confirm` | Yes | - | Required acknowledgement for destructive operations |

Output: `{ "deleted": true, "id": "<id>" }`

### Example

```bash
talkvalue path channel delete ch_01abc123 --confirm
```

---

## channel people

List people who belong to a channel, with optional search and pagination.

```bash
talkvalue path channel people <channelId> [flags]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--keyword <term>` | No | - | Filter by name, email, or other searchable fields |
| `--event-id <id>` | No | - | Filter by event; repeatable for multiple events |
| `--company-id <id>` | No | - | Filter by company ID |
| `--company-name <name>` | No | - | Filter by company name |
| `--job-title <title>` | No | - | Filter by job title |
| `--page <n>` | No | `1` | Page number (1-indexed) |
| `--page-size <n>` | No | - | Results per page |
| `--sort <value>` | No | - | Sort expression; repeatable (e.g. `joinedAt:desc`) |

Output columns: ID, Name, Email, Phone, Company, Job Title, Joined At

### Example

```bash
talkvalue path channel people ch_01abc123
talkvalue path channel people ch_01abc123 --keyword "acme"
talkvalue path channel people ch_01abc123 --sort joinedAt:desc --page-size 50
talkvalue path channel people ch_01abc123 --event-id 16 --event-id 22 --format json
```

---

## channel add-person

Add a person to a channel. If the email already exists in the organization, the existing contact is linked. Otherwise a new contact is created.

```bash
talkvalue path channel add-person <channelId> --email <email> [flags]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `-e`, `--email <email>` | Yes | - | Primary email address |
| `--first-name <name>` | No | - | First name |
| `--last-name <name>` | No | - | Last name |
| `--phone <number>` | No | - | Phone number; repeatable for multiple numbers |
| `--job-title <title>` | No | - | Job title |
| `--address <address>` | No | - | Mailing or physical address |
| `--avatar-url <url>` | No | - | URL to the person's avatar image |
| `--linked-in-url <url>` | No | - | LinkedIn profile URL |
| `--x-url <url>` | No | - | X (formerly Twitter) profile URL |
| `--company-name <name>` | No | - | Company or organization name |
| `--joined-at <timestamp>` | No | - | ISO 8601 timestamp for when the person joined the channel |

Output: Created person object.

### Example

```bash
# Minimal
talkvalue path channel add-person ch_01abc123 --email jane@acme.com

# With name and company
talkvalue path channel add-person ch_01abc123 \
  --email jane@acme.com \
  --first-name Jane \
  --last-name Doe \
  --company-name "Acme Corp" \
  --job-title "Head of Product"

# Full profile with multiple phone numbers
talkvalue path channel add-person ch_01abc123 \
  --email jane@acme.com \
  --first-name Jane \
  --last-name Doe \
  --phone "+1-555-0100" \
  --phone "+1-555-0101" \
  --job-title "Head of Product" \
  --company-name "Acme Corp" \
  --linked-in-url "https://linkedin.com/in/janedoe" \
  --x-url "https://x.com/janedoe" \
  --joined-at "2025-01-15T00:00:00Z"
```

---

## channel export

Export all people in a channel as CSV.

```bash
talkvalue path channel export <channelId>
```

No flags. Output is always CSV regardless of `--format`.

### Example

```bash
# Save to file
talkvalue path channel export ch_01abc123 > channel-members.csv

# Pipe to another tool
talkvalue path channel export ch_01abc123 | cut -d',' -f1,2,3
```

---

## Tips

- Run `channel list --format json` to get channel IDs for scripting.
- `channel export` always produces CSV. The `--format` flag has no effect on export commands.
- The `--phone` flag on `add-person` is repeatable. Pass it multiple times to store multiple phone numbers for one person.
- `--joined-at` accepts ISO 8601 format, e.g. `2025-03-01T00:00:00Z`. Omit it to default to the server-side current time.
- Before deleting a channel, run `channel people` to review its current membership.

## See Also

- `../talkvalue-shared/SKILL.md` — Auth, global flags, output formatting, and pagination
- `../talkvalue-person/SKILL.md` — Manage individual contacts directly
- `../talkvalue-company/SKILL.md` — Company-level contact views and filtering
- `../talkvalue-event/SKILL.md` — Event registration and attendance data
