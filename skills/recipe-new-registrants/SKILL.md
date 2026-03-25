---
name: recipe-new-registrants
description: "Find this month's event registrants and export them."
metadata:
  version: 1.0.0
  openclaw:
    category: "recipe"
    domain: "events"
    requires:
      bins:
        - talkvalue
      skills:
        - talkvalue-event
        - talkvalue-person
---

# Recipe: New Registrants

> **PREREQUISITE:** Load the following skills to execute this recipe: talkvalue-event, talkvalue-person

## Steps

1. List all events to find the target event ID:

   ```bash
   talkvalue path event list --json
   ```

2. List event registrants sorted by join date, newest first:

   ```bash
   talkvalue path event person list <eventId> --sort joinedAt:desc --json
   ```

3. Export the full registrant list to a CSV file:

   ```bash
   talkvalue path event person export <eventId> > registrants.csv
   ```

## Tips

- Use `--page-size 100` to fetch more results per page.
- Pipe `--json` output to `jq` to filter by a specific date range:
  ```bash
  talkvalue path event person list <eventId> --sort joinedAt:desc --json \
    | jq '[.data[] | select(.joinedAt >= "2026-03-01")]'
  ```
