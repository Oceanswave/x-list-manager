const { chromium } = require('playwright');

const USAGE = `NAME
    verify-handles.cjs -- check whether X handles exist

USAGE
    node scripts/verify-handles.cjs <handle> [handle...]

DESCRIPTION
    Connects to a running Chromium over CDP and visits each profile page.
    Prints OK per handle if the account exists, MISSING if X reports the
    account does not exist, SUSPENDED if the account is suspended.

    NOTE: existence is NOT identity. A profile page can render while the
    account is a squatter, bot, or random person with a plausible name
    (observed 2026-08-13: @TSMC_Official was a hiphop-dancer account).
    Use probe-bios.cjs to confirm who an account actually is before
    adding it to a curated list.

OPTIONS
    -h, --help   show this help and exit

EXAMPLES
    node scripts/verify-handles.cjs MoonshotAI_ ZhipuAI
    node scripts/verify-handles.cjs $(cat handles.txt)

SEE ALSO
    probe-bios.cjs, x-search-users.cjs`;

const HANDLES = process.argv.slice(2).filter(a => a !== '--help' && a !== '-h');

if (HANDLES.length === 0 || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(USAGE);
  process.exit(process.argv.includes('--help') || process.argv.includes('-h') ? 0 : 1);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const results = [];
  for (const h of HANDLES) {
    try {
      await page.goto(`https://x.com/${h}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500 + Math.random() * 1500);
      const body = await page.locator('body').innerText();
      const missing = /doesn.t exist/i.test(body);
      const suspended = /suspended/i.test(body);
      results.push({ h, status: missing ? 'NOT_FOUND' : suspended ? 'SUSPENDED' : 'OK' });
      console.log(`${missing || suspended ? 'MISSING' : 'OK     '}  @${h}`);
    } catch (e) {
      results.push({ h, status: 'ERROR', error: String(e).slice(0, 80) });
      console.log(`ERROR   @${h} ${String(e).slice(0, 80)}`);
    }
  }
  await page.close();
  await browser.close();
  const bad = results.filter(r => r.status !== 'OK');
  console.log(`\nVerified ${results.length}: ${results.length - bad.length} OK, ${bad.length} missing/error`);
})();
