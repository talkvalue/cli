---
name: talkvalue-import
description: "CSV import: analyze files, create import jobs, monitor progress, and export failures."
metadata:
  version: 1.2.2
  openclaw:
    category: "productivity"
    requires:
      bins:
        - talkvalue
    cliHelp: "talkvalue path import --help"
---

# TalkValue CLI — Import

> **PREREQUISITE:** Read ../talkvalue-shared/SKILL.md for auth, global flags, and output formatting.

## Overview

The `import` group manages CSV contact imports end-to-end: upload and analyze a file, create an import job with column mappings, monitor progress by listing or fetching jobs, and export failed rows for debugging.

```bash
talkvalue path import <action> [arguments] [flags]
```

The typical workflow is: **analyze** a file to get a `fileKey`, then **create** a job referencing that key.

---

## Commands

### `import list`

List import jobs for the active organization, newest first.

```bash
talkvalue path import list [--page <n>] [--page-size <n>]
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--page <n>` | No | 1 | Page number (1-indexed) |
| `--page-size <n>` | No | 20 | Results per page |

**Output columns:** ID, Status, Mode, File Name, Total, Processed, New, Failed, Completed At

**Examples**

```bash
# First page with default page size
talkvalue path import list

# Second page, 50 results
talkvalue path import list --page 2 --page-size 50

# JSON for scripting
talkvalue path import list --json
```

---

### `import get`

Get the full details of a single import job.

```bash
talkvalue path import get <id>
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Import job ID |

**Output:** Import job object

**Examples**

```bash
talkvalue path import get imp_abc123

# Watch status until complete
while true; do
  status=$(talkvalue path import get imp_abc123 --json | jq -r '.data.status')
  echo "Status: $status"
  [ "$status" = "COMPLETED" ] && break
  sleep 10
done
```

---

### `import analyze`

Upload and analyze a CSV file. Returns a `fileKey` and column metadata used to build the `import create` mapping.

```bash
talkvalue path import analyze --file <path>
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--file <path>` | Yes | — | Path to the CSV file to analyze |

**Output:** Analysis result containing `fileKey` and detected column information

**Examples**

```bash
talkvalue path import analyze --file ./contacts.csv

# Capture the file key for the next step
FILE_KEY=$(talkvalue path import analyze --file ./contacts.csv --json | jq -r '.data.fileKey')
```

---

### `import create`

> **Caution:** This command creates an import job that writes contact data into a channel. Verify your column mappings against the analyze output before running. Jobs cannot be cancelled once started.

Create an import job from a previously analyzed CSV file.

```bash
talkvalue path import create \
  --file-key <key> \
  --source-id <channelId> \
  --mode <UPDATE|SKIP> \
  --mapping <csvIndex:targetField> \
  [--mapping <csvIndex:targetField> ...]
```

**Flags**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--file-key <key>` | Yes | — | File key returned by `import analyze` |
| `--source-id <id>` | Yes | — | Channel ID to import contacts into |
| `--mode <UPDATE\|SKIP>` | Yes | — | Conflict mode: `UPDATE` overwrites existing records; `SKIP` leaves them unchanged |
| `--mapping <csvIndex:targetField>` | Yes (repeatable, min 1) | — | Column mapping in `csvIndex:targetField` format. Repeat for each field to import. |

**Valid target fields**

| Field | Description |
|-------|-------------|
| `EMAIL` | Email address |
| `FIRST_NAME` | First name |
| `LAST_NAME` | Last name |
| `NAME` | Full name |
| `PHONE` | Phone number |
| `JOB_TITLE` | Job title |
| `COMPANY_NAME` | Company name |
| `ADDRESS` | Address |
| `LINKEDIN_URL` | LinkedIn profile URL |
| `X_URL` | X (Twitter) profile URL |
| `JOINED_AT` | Date the contact joined |

`csvIndex` is 0-based and matches the column order reported by `import analyze`.

**Output:** Created import job object

**Examples**

```bash
# Minimal import: email only, skip existing
talkvalue path import create \
  --file-key fk_xyz789 \
  --source-id chan_def456 \
  --mode SKIP \
  --mapping 0:EMAIL

# Full import: update existing, map six columns
talkvalue path import create \
  --file-key fk_xyz789 \
  --source-id chan_def456 \
  --mode UPDATE \
  --mapping 0:EMAIL \
  --mapping 1:FIRST_NAME \
  --mapping 2:LAST_NAME \
  --mapping 3:JOB_TITLE \
  --mapping 4:COMPANY_NAME \
  --mapping 5:PHONE

# End-to-end: analyze then create
FILE_KEY=$(talkvalue path import analyze --file ./contacts.csv --json | jq -r '.data.fileKey')
talkvalue path import create \
  --file-key "$FILE_KEY" \
  --source-id chan_def456 \
  --mode UPDATE \
  --mapping 0:EMAIL \
  --mapping 1:FIRST_NAME \
  --mapping 2:LAST_NAME
```

---

### `import failed-export`

Export all rows that failed during an import job as a CSV stream.

```bash
talkvalue path import failed-export <id>
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<id>` | Import job ID |

**Output:** CSV stream. Always CSV regardless of `--format` or `--json` flags.

**Examples**

```bash
# Print to terminal
talkvalue path import failed-export imp_abc123

# Save to file
talkvalue path import failed-export imp_abc123 > failed_rows.csv

# Count failed rows
talkvalue path import failed-export imp_abc123 | tail -n +2 | wc -l
```

---

## Tips

- Run `import analyze` before `import create`. The `fileKey` returned by analyze is required and expires after a period of inactivity.
- Column indexes in `--mapping` are 0-based and match the order shown in the analyze output. Double-check before submitting.
- `UPDATE` mode overwrites matching contact fields. Use `SKIP` when you want to protect existing data and only add net-new contacts.
- Check `import get <id>` after submission to monitor `status`, `processed`, and `failed` counts.
- If `failed` is non-zero after completion, run `import failed-export <id>` to retrieve the rows and their error reasons.

## See Also

- `../talkvalue-shared/SKILL.md` — Auth, global flags, output formats, exit codes
- `../talkvalue-analysis/SKILL.md` — Analyze channel attribution and audience overlap after importing
