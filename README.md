# X List Manager (x-list-manager)

CLI to manage X/Twitter lists using Playwright and Chrome cookies.

This tool automates the process of adding/removing users from your X lists by using your existing Chrome session. No API key required.

## Prerequisites

- Node.js (v18+)
- Python 3
- Google Chrome (logged into X.com)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Oceanswave/x-list-manager.git
   cd x-list-manager
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Install Python dependency (for cookie extraction):**
   ```bash
   pip install browser-cookie3
   ```

4. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

## Usage

### Authentication
The tool uses `browser-cookie3` to extract your X.com cookies from Chrome. Make sure you are logged in to X in Chrome.

**Refresh cookies:**
If your session expires or it's your first run:
```bash
npx tsx cli.ts refresh
```

**Check login status:**
```bash
npx tsx cli.ts check
```

### Managing Lists

**Add users to a list:**
```bash
# Usage: add "List Name" @handle1 @handle2 ...
npx tsx cli.ts add "AI News" @OpenAI @AnthropicAI
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
npx tsx cli.ts batch accounts.json
```

**Remove a user:**
```bash
npx tsx cli.ts remove @handle "List Name"
```

**View your lists:**
```bash
npx tsx cli.ts list
```

## Troubleshooting

- **"Not logged in"**: Run `npx tsx cli.ts refresh`. Ensure you are logged in on Chrome.
- **"List not found"**: Double-check the list name (case-sensitive).
- **"User not found"**: Ensure the handle is correct.
- **Selectors failed**: X.com UI changes often. If the tool breaks, check for updates or inspecting the page structure.

## License

MIT © 2026 Barista Labs
