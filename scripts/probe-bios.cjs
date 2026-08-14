const { chromium } = require('playwright');

const USAGE = `NAME
    probe-bios.cjs -- print profile identity and activity for X handles

USAGE
    node scripts/probe-bios.cjs <handle> [handle...]

DESCRIPTION
    Connects to a running Chromium over CDP and reads each profile's
    display name, bio, location, and most recent post date. Use this to
    confirm an account IS the firm you think it is before adding it to a
    curated list. A handle that resolves (see verify-handles.cjs) can
    still belong to a squatter, a bot, or a dormant account - the bio and
    last-post date tell you which.

    last: none means no posts are visible on the profile (fresh account
    or never posted). A last-post date years in the past marks a dormant
    account.

OPTIONS
    -h, --help   show this help and exit

EXAMPLES
    node scripts/probe-bios.cjs TSMC_Official          # reveals squatter
    node scripts/probe-bios.cjs megvii iflytek1999     # shows dormancy

SEE ALSO
    verify-handles.cjs, x-search-users.cjs`;

const HANDLES = process.argv.slice(2).filter(a => a !== '--help' && a !== '-h');

if (HANDLES.length === 0 || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(USAGE);
  process.exit(process.argv.includes('--help') || process.argv.includes('-h') ? 0 : 1);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  for (const h of HANDLES) {
    try {
      await page.goto('https://x.com/' + h, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3500 + Math.random() * 1500);
      const info = await page.evaluate(() => {
        const name = document.querySelector('[data-testid="UserName"]')?.innerText || '';
        const bio = document.querySelector('[data-testid="UserDescription"]')?.innerText || '';
        const location = document.querySelector('[data-testid="UserProfileHeader_Items"]')?.innerText || '';
        const times = [...document.querySelectorAll('time')].map(t => t.getAttribute('datetime')).filter(Boolean);
        return { name: name.slice(0, 60), bio: bio.slice(0, 160), location: location.slice(0, 60), lastPost: times[0] || 'none' };
      });
      console.log('@' + h + ' | ' + info.name.replace(/\n/g, ' ') + ' | loc: ' + info.location.replace(/\n/g, ' ') + ' | last: ' + info.lastPost + ' | bio: ' + info.bio.replace(/\n/g, ' '));
    } catch (e) { console.log('@' + h + ' | ERROR ' + String(e).slice(0, 60)); }
  }
  await page.close();
  await browser.close();
})();
