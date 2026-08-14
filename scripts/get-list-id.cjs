const { chromium } = require('playwright');

const USAGE = `NAME
    get-list-id.cjs -- resolve an X list name to its numeric list ID

USAGE
    node scripts/get-list-id.cjs [listName]

DESCRIPTION
    Connects to a running Chromium over CDP, opens the lists page, and
    prints the numeric ID (from /i/lists/<id> links) of the named list.
    Defaults to "chinese-ai". The slug URL form (x.com/user/lists/name)
    does not exist for members pages - you need the numeric ID for
    /i/lists/<id>/members and /i/lists/<id>/info.

OPTIONS
    -h, --help   show this help and exit

EXAMPLES
    node scripts/get-list-id.cjs
    node scripts/get-list-id.cjs chinese-ai

SEE ALSO
    ls-lists.cjs`;

const LIST_NAME = process.argv[2] || 'chinese-ai';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://x.com/archerships/lists', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(600); }
  const ids = await page.evaluate((name) => {
    const out = new Set();
    document.querySelectorAll('[data-testid="cellInnerDiv"]').forEach(cell => {
      if (new RegExp(name, 'i').test(cell.innerText)) {
        cell.querySelectorAll('a[href*="/i/lists/"]').forEach(a => {
          const m = a.getAttribute('href').match(/\/i\/lists\/(\d+)/);
          if (m) out.add(m[1]);
        });
      }
    });
    return [...out];
  }, LIST_NAME);
  if (ids.length === 0) {
    console.log(`No /i/lists/<id> link found for "${LIST_NAME}" (the list cell may render the link differently; check ls-lists.cjs output for the exact name).`);
  } else {
    console.log(ids.join('\n'));
  }
  await page.close();
  await browser.close();
})();
