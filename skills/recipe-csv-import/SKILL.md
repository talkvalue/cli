---
name: recipe-csv-import
description: "Full CSV import workflow: analyze a file, create an import job, monitor progress, and export failures."
metadata:
  version: 1.0.0
  openclaw:
    category: "recipe"
    domain: "data"
    requires:
      bins:
        - talkvalue
      skills:
        - talkvalue-import
        - talkvalue-channel
---

# Recipe: CSV Import

> **PREREQUISITE:** Load the following skills to execute this recipe: talkvalue-import, talkvalue-channel

## Steps

1. Analyze the CSV file to get column info and a file key:

   ```bash
   talkvalue path import analyze --file contacts.csv --json
   ```

2. Review the output. Note the `fileKey` and column indices before continuing.

3. Create the import job with column mappings:

   ```bash
   talkvalue path import create \
     --file-key <fileKey> \
     --source-id <channelId> \
     --mode UPDATE \
     --mapping 0:EMAIL \
     --mapping 1:FIRST_NAME \
     --mapping 2:LAST_NAME \
     --json
   ```

4. Monitor import progress using the returned `importId`:

   ```bash
   talkvalue path import get <importId> --json
   ```

5. If there are failures, export the failed rows:

   ```bash
   talkvalue path import failed-export <importId> > failed-rows.csv
   ```

## Tips

- `--mode UPDATE` updates existing contacts matched by email. `--mode SKIP` skips any row that matches an existing contact.
- Valid mapping target fields: `EMAIL`, `FIRST_NAME`, `LAST_NAME`, `NAME`, `PHONE`, `JOB_TITLE`, `COMPANY_NAME`, `ADDRESS`, `LINKEDIN_URL`, `X_URL`, `JOINED_AT`.
- Re-import `failed-rows.csv` after correcting data to clear the failure count.
