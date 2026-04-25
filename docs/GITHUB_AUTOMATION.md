# GitHub Actions data collection

This project can collect public proxy voting sources automatically with GitHub Actions.

## What runs

- `npm run collect:data`
- `npm run build`
- Commit changed JSON files under `data/` and `data/generated/`

## Schedule

`.github/workflows/data-collection.yml` runs weekly:

- Monday 08:00 JST
- Sunday 23:00 UTC

It also supports manual execution from GitHub Actions with `workflow_dispatch`.

## Safety policy

The workflow uses `data/collection_policy.json`.

The collection scripts are limited to:

- public official pages, PDFs, Excel files, and HTML
- low-frequency access with delay
- cached downloads when the same URL was already collected
- no login, CAPTCHA, form submission, paywall bypass, private API, or personal data collection

## Security note

The workflow intentionally avoids third-party auto-commit actions. It uses only:

- `actions/checkout`
- `actions/setup-node`
- standard `npm` and `git` commands

If GitHub shows a security warning, first check dependency alerts and workflow permission changes. The workflow only grants `contents: write` so it can commit updated JSON data back to the repository.
