const { chromium } = require('playwright');

const USAGE = `NAME
    ls-lists.cjs -- list the logged-in user's X lists

USAGE
    node scripts/ls-lists.cjs

DESCRIPTION
    Connects to a running Chromium over CDP and prints the names, member
    counts, and descriptions of every list belonging to the logged-in
    user. Use this when the CLI 'list' command times out on its
    cellInnerDiv visibility wait (observed 2026-08-13) or when you need
    the exact list name spelling before running add/remove.

OPTIONS
    -h, --help   show this help and exit

EXAMPLES
    node scripts/ls-lists.cjs | grep -i chinese

SEE ALSO
    get-list-id.cjs, cli.ts (add/remove/list/batch)`;

const ARGS = process.argv.slice(2);

if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://x.com/archerships/lists', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const items = await page.locator('[data-testid="cellInnerDiv"]').allInnerTexts();
  for (const t of items) {
    const lines = t.split('\n').filter(l => l.trim());
    console.log('---', lines.slice(0, 3).join(' | '));
  }
  await page.close();
  await browser.close();
})();
