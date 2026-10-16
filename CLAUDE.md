# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page job application tracker in plain HTML, CSS and JavaScript. There is no framework and no build step: `index.html` loads `style.css` and `app.js` directly. Open `index.html` in a browser, or serve the folder with a static server.

## Commands

Node is at `/opt/homebrew/bin`, which may not be on PATH in the shell: `export PATH=/opt/homebrew/bin:$PATH`.

- `npm install`, then `npm run test:install` (installs the Chromium and WebKit browsers for Playwright)
- `npm test`: runs the full Playwright suite in both Chromium and WebKit. Playwright starts its own static server (`http-server` on 127.0.0.1:4173) and reuses one if it is already running.
- Single test: `npx playwright test -g "test title"`; single browser: `npx playwright test --project=chromium`; single file: `npx playwright test tests/tracker.spec.js`
- `npx playwright show-report` serves the HTML report from `playwright-report/`. Stop it afterwards, because it keeps running.

There is no linter or build.

## Architecture

- **`app.js`** is one IIFE that owns all behavior. Records live in an in-memory `apps` array, mirrored to `localStorage` under the key `jobApplications` on every change. `render()` rebuilds the whole table and chips from state; handlers mutate state and call `render()`.
- **Record shape:** `{id, company, role, date (YYYY-MM-DD), status, notes}`, with `status` one of the `STATUSES` array (Applied, Interviewing, Offer, Rejected, Withdrawn).
- **Rendering uses `textContent` only, never `innerHTML`.** Keep it that way, since notes and company names are user input.
- **Search and status filter** (`searchQuery`, `statusFilter`) are in-memory only and are not persisted. Chip counts follow the search text. Filtering never affects Export, Import or the `#summary` total, which always use all records.
- **Two distinct empty states:** `#empty` means there are no records at all, `#no-matches` means records exist but the filters hide them. Existing tests depend on this distinction. Filters reset when the last record is deleted.
- **Export/Import:** Export downloads `job-tracker-YYYY-MM-DD.json` via Blob. Import validates strictly, so one bad record rejects the whole file with an error message. A `<dialog>` then offers Replace or Merge. A duplicate is the same `id`, or the same lower-cased and trimmed company + role + date.

## Tests

`tests/tracker.spec.js` is the only spec file. Tests seed data through `localStorage` plus a reload, or by driving the UI, and locate status chips by accessible name (for example "Applied 2"), so changing chip label text will break them. Playwright output (`test-results/`, `playwright-report/`) and `node_modules/` are gitignored. So are likely personal files: `data/`, `job-tracker-*.json` exports, `*.xlsx`, `*.docx`, `*.pdf` and `.env`. Never commit those.

## CI

`.github/workflows/playwright.yml` runs the suite on every push and pull request to `main` on `ubuntu-24.04`, and uploads the HTML report as an artifact even when tests fail.

A `deploy` job (`needs: test`, pushes to `main` only, never PRs) publishes the site to GitHub Pages at https://markjohnsonatx.github.io/first-app/. It copies only `index.html`, `style.css` and `app.js` into `_site/`, so a new runtime file must be added to that `cp` step or it will be missing from the live site. Pages must have **Settings > Pages > Source: GitHub Actions**. If tests fail, deploy is skipped and the previous site stays live.
