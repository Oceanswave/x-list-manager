# x-list-manager Technical Specification

## Overview
`x-list-manager` is a command-line tool designed to manage X (formerly Twitter) lists automatically. It allows users to add or remove accounts from lists and batch process list memberships using a simple CLI. The tool operates by automating a headless browser (Playwright) using the user's existing Chrome session cookies, bypassing the need for expensive or restricted official APIs.

## Architecture

### Components
1.  **CLI Entry Point (`scripts/cli.ts`)**:
    -   Built with Node.js and `commander`.
    -   Handles argument parsing and command dispatch.
    -   Orchestrates the browser session via Playwright.

2.  **Browser Automation (Playwright)**:
    -   Launches a Chromium instance (headless by default).
    -   Navigates to X.com and interacts with the UI (clicks, typing, waiting for selectors).
    -   Uses a persistent browser context to maintain login state.

3.  **Authentication (Cookies)**:
    -   **Source**: Extracts valid session cookies directly from the local Google Chrome installation.
    -   **Mechanism**: Uses a Python script (`scripts/get_cookies.py`) leveraging the `browser-cookie3` library to decrypt and read the Chrome cookie database.
    -   **Storage**: Cached in `auth.json` to reduce the need for repeated extraction.

### Data Flow
1.  User runs a command (e.g., `add`).
2.  CLI checks for cached `auth.json`.
3.  If missing/expired, CLI spawns Python script to fetch Chrome cookies.
4.  Playwright context is initialized with these cookies.
5.  Browser navigates to the target user profile.
6.  Script interacts with the "More" menu -> "Add/remove from Lists".
7.  Script toggles the appropriate list checkbox and clicks "Save".

## CLI Reference

### Global Options
-   `--no-headless`: Runs the browser in visible mode (useful for debugging).
-   `--help`: Displays help information.

### Commands

#### `add <listName> <handles...>`
Adds one or more users to a specified list.
-   **Arguments**:
    -   `listName`: Exact name of the X list (case-sensitive).
    -   `handles`: Space-separated user handles (e.g., `@elonmusk @jack`).
-   **Example**: `npx tsx scripts/cli.ts add "Tech Leaders" @elonmusk`

#### `remove <handle> <listName>`
Removes a user from a specified list.
-   **Arguments**:
    -   `handle`: User handle to remove.
    -   `listName`: Exact name of the list.
-   **Example**: `npx tsx scripts/cli.ts remove @elonmusk "Tech Leaders"`

#### `batch <file>`
Process multiple additions from a JSON file.
-   **Arguments**:
    -   `file`: Path to a JSON file.
-   **JSON Format**:
    ```json
    {
      "Tech Leaders": ["@elonmusk", "@jack"],
      "News": ["@CNN", "@BBC"]
    }
    ```
-   **Example**: `npx tsx scripts/cli.ts batch accounts.json`

#### `list`
Displays the names of lists owned by the current user.
-   **Example**: `npx tsx scripts/cli.ts list`

#### `check`
Verifies if the current session cookies are valid and logged in.
-   **Example**: `npx tsx scripts/cli.ts check`

#### `refresh`
Forces a fresh extraction of cookies from Chrome and updates `auth.json`.
-   **Example**: `npx tsx scripts/cli.ts refresh`

## Cookie Extraction & Storage
-   **Tool**: `browser-cookie3` (Python).
-   **Process**: 
    1.  Node.js spawns a Python child process.
    2.  Python script reads the Chrome cookie database (OS-dependent path).
    3.  Cookies for `.x.com` and `.twitter.com` are filtered.
    4.  JSON output is returned to Node.js.
-   **Security**: Cookies are stored locally in `auth.json`. This file should be git-ignored.

## Output Format
-   **Success**: `✓ Added @handle to "List Name".`
-   **No Change**: `✓ @handle already in "List Name".`
-   **Error**: `❌ List "List Name" not found.` or specific error messages.
-   **Batch**: Provides a summary of Added/Already In/Errors count.

## Selector Patterns
Critical UI selectors used for automation. See `docs/SELECTORS.md` for the full list and maintenance instructions.

-   **User Actions**: `[data-testid="userActions"]`
-   **Menu Item**: `[role="menuitem"]:has-text("Add/remove from Lists")`
-   **Dialog**: `[role="dialog"]:has(div[role="checkbox"])`
