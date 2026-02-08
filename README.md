# X List Manager (x-list-manager)

A CLI tool to manage X (Twitter) lists using Playwright and Chrome cookies. Automate adding and removing users from your lists without needing an expensive API key.

## Designed for Autonomous Agents

x-list-manager is built to be used as a skill by AI agents (OpenClaw, Claude Code, etc.) for automated X/Twitter list management. It:

- **Runs headlessly** by default (no GUI needed)
- **Uses existing cookies** (no manual login flow)
- **Provides clear CLI output** for agent parsing
- **Handles edge cases gracefully** (user not found, already in list, etc.)
- **Follows standard skill patterns** (SKILL.md, SPEC.md, TASKS.md)

Agents can invoke it via:
```bash
npx tsx scripts/cli.ts add "List Name" @handle1 @handle2
```

Or use it programmatically for batch operations with JSON input.

## Features

- **No API Key Required**: Uses your existing browser session.
- **List Management**: Add or remove users from lists easily.
- **Batch Operations**: Support for adding multiple users via JSON.
- **Auto-Cookie Extraction**: Seamlessly uses Chrome cookies via `browser-cookie3`.
- **Headless Execution**: Runs in the background (default) or visible mode.

## Installation

### Prerequisites

- Node.js (v18+)
- Python 3 (for cookie extraction)
- Google Chrome (logged into X.com)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Oceanswave/x-list-manager.git
   cd x-list-manager
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   npx playwright install chromium
   ```

3. **Install Python dependency:**
   ```bash
   pip install browser-cookie3
   ```

## Usage

### Authentication
The tool uses `browser-cookie3` to extract your X.com cookies from Chrome. Make sure you are logged in to X in Chrome.

**Refresh cookies:**
If your session expires or it's your first run:
```bash
npx tsx scripts/cli.ts refresh
```

**Check login status:**
```bash
npx tsx scripts/cli.ts check
```

### Managing Lists

**Add users to a list:**
```bash
# Usage: add "List Name" @handle1 @handle2 ...
npx tsx scripts/cli.ts add "AI News" @OpenAI @AnthropicAI
```

**Batch add from JSON:**
Create a file `accounts.json`:
```json
{
  "AI News": ["@OpenAI", "@DeepMind"],
  "Tech": ["@Verge", "@TechCrunch"]
}
```

Run:
```bash
npx tsx scripts/cli.ts batch accounts.json
```

**Remove a user:**
```bash
npx tsx scripts/cli.ts remove @handle "List Name"
```

**View your lists:**
```bash
npx tsx scripts/cli.ts list
```

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Branch Protection**: Direct pushes to `main` are disabled.
2. **Pull Requests**: Create a feature branch (e.g., `feat/my-feature`) and open a PR.
3. **Auto-Merge**: PRs are automatically merged when checks pass (squash merge).
4. **Cleanup**: Branches are automatically deleted after merge or if the PR is closed without merging.

## License

MIT © 2026 Barista Labs
