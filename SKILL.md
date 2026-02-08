# X List Manager (x-list-manager)

A simple TypeScript CLI for managing X (Twitter) lists using Playwright and Chrome cookies.

## Capabilities

- Add users to lists: `add "List Name" @handle1 @handle2`
- Remove users from lists: `remove @handle "List Name"`
- Batch add from file: `batch accounts.json`
- List your lists: `list`
- Check login status: `check`
- Refresh cookies: `refresh` (extracts from Chrome)

## Usage

### 1. Installation

First, ensure you have Node.js and Python installed.

```bash
cd ~/clawd/skills/x-list-manager
npm install
pip install browser-cookie3
```

### 2. Authentication

This tool uses cookies from your Chrome browser. Log in to X.com in Chrome first.

**Check status:**
```bash
npx tsx cli.ts check
```

**Refresh cookies (if expired):**
```bash
npx tsx cli.ts refresh
```

### 3. Managing Lists

**Add users to a list:**
```bash
npx tsx cli.ts add "Tech Leaders" @elonmusk @jack
```

**Remove a user from a list:**
```bash
npx tsx cli.ts remove @elonmusk "Tech Leaders"
```

**Batch add users from a JSON file:**
Create a JSON file (e.g., `accounts.json`):
```json
{
  "Tech Leaders": ["@elonmusk", "@jack"],
  "AI Researchers": ["@ylecun", "@geoffreyhinton"]
}
```

Run:
```bash
npx tsx cli.ts batch accounts.json
```

**List your lists:**
```bash
npx tsx cli.ts list
```

## Options

- `--headless` (default): Run browser in background.
- `--no-headless`: Run browser visibly (useful for debugging).

## Troubleshooting

- If authentication fails, run `npx tsx cli.ts refresh`.
- Ensure you are logged into X.com in Chrome.
- If selectors change on X.com, the tool may need updates.
