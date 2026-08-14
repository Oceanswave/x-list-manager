# x-list-manager: Tutorial

Manage X/Twitter lists by driving a live Chromium over CDP. This repo is
a fork of Oceanswave/x-list-manager converted from Chrome-cookie
extraction to CDP attach (2026-08-12) and extended with identity-verification
helper scripts (2026-08-13).

## Prerequisites

1. Chromium running with the CDP port open:
   ```bash
   open -a Chromium --args --remote-debugging-port=9222 --no-first-run --no-startup-window
   ```
2. The Chromium **Default profile must be logged into X** (auth_token +
   ct0 cookies). Verify the port answers:
   ```bash
   curl -s http://localhost:9222/json/version
   ```
3. Node 22+ and dependencies installed:
   ```bash
   cd ~/av/prj/x-list-manager && npm install
   ```

## Main CLI

Run commands from the repo root:

```bash
npx tsx scripts/cli.ts check          # logged-in check
npx tsx scripts/cli.ts list           # list your lists
npx tsx scripts/cli.ts add <list> @handle1 @handle2 ...
npx tsx scripts/cli.ts remove <handle> <list>
npx tsx scripts/cli.ts batch file.json   # {"List": ["@h1", ...]}
```

The `add` and `remove` commands visit each profile, open the
Add/remove from Lists menu, and toggle the list checkbox. The `add`
command applies randomized human pacing (2-4s profile load, 6-14s
between profiles) - do not replace it with the `batch` command, which
uses fixed 2s sleeps and is a bot-detection pattern.

## Helper scripts (CDP identity + discovery)

These live in `scripts/` and all connect to the same CDP Chromium.

| Script | Purpose | Usage |
| :--- | :--- | :--- |
| `ls-lists.cjs` | List the user's lists (fallback when `cli.ts list` times out) | `node scripts/ls-lists.cjs` |
| `get-list-id.cjs` | Resolve a list name to its numeric `/i/lists/<id>` | `node scripts/get-list-id.cjs [name]` |
| `verify-handles.cjs` | Check handles exist on X | `node scripts/verify-handles.cjs @h1 @h2 ...` |
| `probe-bios.cjs` | Print profile name/bio/location/last-post for identity + activity | `node scripts/probe-bios.cjs @h1 @h2 ...` |
| `x-search-users.cjs` | X user search to find the real official account | `node scripts/x-search-users.cjs "Company"` |

Every script supports `--help`.

## The identity-verification workflow (MANDATORY for curated lists)

Existence is not identity. A profile page can render while the account
is a squatter, bot, or random person. Observed 2026-08-13: @TSMC_Official
was a 2014 hiphop-dancer account, @Appier_AI a bot, @iKala/@ProfetAI/
@ViduAI random people. Verify before adding:

1. **Existence**: `node scripts/verify-handles.cjs @handle`
2. **Identity**: `node scripts/probe-bios.cjs @handle` -- confirm the
   display name, bio, and website link match the firm.
3. **Discovery**: if the given handle is missing or wrong, run
   `node scripts/x-search-users.cjs "Firm Name"` and probe the candidates.
4. **Activity**: the last-post date from probe-bios.cjs tells you if the
   account is dormant (years old) or fresh. Decide if a dormant account
   is worth a slot in the list.

Only add accounts that pass all four steps.

## Verification steps (after any add/remove)

- Re-run `add` or `remove` for a sample handle: `add` prints
  "already in <list>" and `remove` prints "not in <list>" when the state
  is correct.
- Confirm the exact list name exists first with `ls-lists.cjs`.

## Bot-detection cautions

- Never use fixed delays; the CLI's randomized pacing is deliberate.
- Space batch sessions (dozens of profile visits) by days, not minutes.
- One X interaction (e.g. a list description edit) is low risk; a burst
  of 30+ profile visits in an hour is not.
