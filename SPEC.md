# x-list-manager Technical Specification

## Overview

`x-list-manager` is a TypeScript CLI that manages X (Twitter) lists by
attaching Playwright to the user's LIVE system Chromium over CDP (port 9222).
No cookie extraction, no separate browser instance -- it drives the logged-in
browser directly, per the user's standing rule (live Chromium only, no
cookie-imported browsers). Supersedes the vendor's original Chrome-cookie
design (2026-08-12 conversion).

## Architecture

### Components

1. **CLI Entry Point (`scripts/cli.ts`)**: Node.js + `commander`. Argument
   parsing, command dispatch, browser orchestration via Playwright.
2. **Browser Automation (Playwright CDP)**: `chromium.connectOverCDP(CDP_URL)`
   attaches to the running Chromium at `http://localhost:9222`. Uses
   `browser.contexts()[0]` (profile-bound context, holds the session cookies;
   a fresh `newContext()` does NOT inherit the profile). ALWAYS creates a
   fresh page per operation and closes it in closeSession -- reusing an
   existing page risks "navigation interrupted by another navigation" from
   X's SPA routing or leftover pages.
3. **Authentication**: NONE -- relies on the user's existing X session in the
   Chromium default profile. `check` verifies login via
   `[data-testid="SideNav_AccountSwitcher_Button"]`.

### Lifecycle

1. User runs a command (e.g., `add`).
2. `getContext()` connects over CDP, grabs the profile context, opens a fresh
   page.
3. Browser navigates to the target profile, opens the "..." menu
   (`[data-testid="userActions"]`), clicks "Add/remove from Lists".
4. Script toggles the list checkbox and clicks "Save".
5. `closeSession()` closes the page, then `browser.close()` (detaches the
   CDP websocket WITHOUT killing the user's Chromium; also lets the Node
   process exit).

## CLI Reference

### Global Options

- `--no-headless`: Accepted for API compatibility; CDP attach is inherently
  headed (it drives the user's visible browser).
- `--help`.

### Commands

#### `create <listName> [-d "description"] [-p]`

Creates a new list. Private with `-p`.
- Flow: goto `/i/lists/create` -> fill `input[name="name"]` (+ optional
  `textarea[name="description"]`, `input[type="checkbox"]` for private) ->
  click "Next" (exact) -> `waitForURL(/\/i\/lists\/\d+/)`. The list EXISTS
  at that point; the follow-up "Add to your List" member form is closed with
  "Done" (best-effort).
- Prints `✅ Created list "<name>": https://x.com/i/lists/<id>`.

#### `delete <listIdOrUrl>`

Deletes a list (accepts bare ID or full URL).
- Flow: goto `/i/lists/<id>/info` -> click link "Edit List" -> click
  "Delete List" -> confirm via `[data-testid="confirmationSheetConfirm"]`.
- NOTE: the confirmation sheet is `role="alertdialog"` (NOT "dialog") with a
  zero-size rect quirk -- always wait on the BUTTON, never the dialog
  element.

#### `add <listName> <handles...>`

Adds one or more users to a list. Idempotent: reports "already in" and skips
without saving when the checkbox is already checked.
- Human pacing REQUIRED (bot detection): all waits randomized via
  `humanDelay(page, minMs, maxMs)`. Profile load 2-4s, menu 0.5-1s (WAIT for
  the menuitem selector with timeout -- X's dropdown animates in 1-2s, fixed
  delays fail), checkbox 0.3-0.8s, save 0.5-1s, and 6-14s between profiles.

#### `remove <handle> <listName>`

Removes a user from a list.

#### `batch <file>`

Batch adds from JSON: `{"List Name": ["@handle1", ...], ...}`. Prints
Added/Already/Errors summary.

#### `list`

Lists the user's lists.

#### `check`

Verifies login status.

#### `refresh`

Verifies the CDP connection (NOT cookie refresh -- no cookies in this
design).

## Output Format

- Success: `✓ Added @handle to "List Name".`
- No change: `✓ @handle already in "List Name".`
- Created: `✅ Created list "<name>": https://x.com/i/lists/<id>`
- Deleted: `✅ Deleted list <id>`
- Error: `❌ List "<name>" not found.` or specific message.

## Selector Patterns

See `docs/SELECTORS.md` for the full list and maintenance instructions.
Critical selectors (verified live 2026-08-12):

- Login check: `[data-testid="SideNav_AccountSwitcher_Button"]`
- User actions: `[data-testid="userActions"]`
- Menu item: `[role="menuitem"]:has-text("Add/remove from Lists")`
  (fallback `:has-text("Lists")`)
- Dialog: `[role="dialog"]:has(div[role="checkbox"]):visible`
- Confirm delete: `[data-testid="confirmationSheetConfirm"]`

## Security

- No secrets stored. No auth.json. Session state stays in the user's
  Chromium profile.
- git-ignored: `node_modules/`, `auth.json`, `user_data/`.
