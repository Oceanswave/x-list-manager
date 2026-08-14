---
name: x-list-manager
description: Manage X/Twitter lists via live Chromium CDP. Create, delete, add, remove, and batch-manage list memberships using the user's logged-in browser session.
argument-hint: 'create "chinese-ai" -p, add "List Name" @handle1 @handle2, delete LIST_ID'
---

# X List Manager (x-list-manager)

TypeScript CLI for managing X (Twitter) lists via Playwright attached to the
LIVE system Chromium over CDP (port 9222). No cookie extraction, no separate
browser instance -- it drives the user's logged-in browser, per the user's
standing rule: live Chromium only, no cookie-imported browsers.

Repo: ~/av/prj/x-list-manager

## Capabilities

- Create a list: `create <listName> [-d "description"] [-p]`
- Delete a list: `delete <listIdOrUrl>`
- Add users to a list: `add <listName> @handle1 @handle2 ...`
- Remove users from a list: `remove @handle <listName>`
- Batch add from file: `batch accounts.json`
- List your lists: `list`
- Check login: `check`
- Verify CDP: `refresh` (connection check, not cookie refresh)

## Prerequisites

- System Chromium running with remote debugging:
  `open -a Chromium --args --remote-debugging-port=9222 --no-first-run --no-startup-window`
- Logged into X in the Chromium default profile
- Node + npm in the repo (npm install done; playwright chromium not needed --
  CDP attaches to the system browser)

## Key implementation facts (learned live 2026-08-12)

- getContext() uses `chromium.connectOverCDP(CDP_URL)` then
  `browser.contexts()[0]` (the profile-bound context has the session cookies;
  a fresh newContext() does NOT inherit the profile).
- ALWAYS create a fresh page per operation (`context.newPage()`) and close it
  in closeSession. Reusing an existing page risks "navigation interrupted by
  another navigation" from SPA routing or leftover pages.
- closeSession: `page.close()` then `browser.close()` -- on a connectOverCDP
  browser, browser.close() only detaches the websocket, does NOT kill the
  user's Chromium, and lets the Node process exit cleanly.
- create flow: goto /i/lists/create -> fill input[name="name"] (+ optional
  textarea[name="description"], input[type="checkbox"] for private) -> click
  "Next" (exact) -> waitForURL /\/i\/lists\/\d+/ -> the list EXISTS at that
  point; the follow-up "Add to your List" member form is closed with "Done".
- delete flow (verified via observe-and-replicate): goto
  /i/lists/<id>/info -> click link "Edit List" -> click "Delete List" text ->
  confirm is role="alertdialog" (NOT "dialog"; zero-size rect quirk) with
  button data-testid="confirmationSheetConfirm". Wait on the BUTTON, never
  the dialog element.
- Human pacing is REQUIRED (bot detection): every wait is randomized via
  humanDelay(page, minMs, maxMs). Profile load 2-4s, menu 0.5-1s (wait for
  the menu item selector, don't rely on fixed delay -- X's menu animates in
  1-2s), checkbox hesitation 0.3-0.8s, save 0.5-1s, and 6-14s between
  profiles (reading pause). Never uniform cadence.

## Usage

```bash
cd ~/av/prj/x-list-manager

# Create a private list
npx tsx scripts/cli.ts create "chinese-ai" -d "desc" -p

# Add accounts (human-paced; ~30s per profile incl pauses)
npx tsx scripts/cli.ts add "chinese-ai" @handle1 @handle2

# Delete a list
npx tsx scripts/cli.ts delete 1234567890
```

## Observe-and-replicate recorder

When a flow fights automation, the recorder in scripts/xlm-observe-all.py
attaches to the live browser, injects a gold banner + click/input/dialog
instrumentation into ALL pages, and streams to a JSONL file while the USER
performs the flow manually. Then encode the captured selectors.

Pitfalls baked in: Python playwright ConsoleMessage.text is a STRING property
(not a method); SPA navigations wipe injected listeners so re-inject must
poll every 2s (load events don't fire on X's client-side routing); instrument
ALL pages in the context -- the user works in THEIR tab, not pages[0].

## Troubleshooting

- "navigation interrupted by another navigation": leftover page from a killed
  run -- the fresh-page-per-op fix in getContext handles this.
- Menu items empty after clicking "..." on a profile: the dropdown animates
  in 1-2s; the fix is waiting for the menuitem selector with a timeout, not a
  fixed delay.
- Not logged in: ensure X session in the Chromium default profile; check with
  `npx tsx scripts/cli.ts check`.
