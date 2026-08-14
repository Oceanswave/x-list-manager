const { chromium } = require('playwright');

const USAGE = `NAME
    x-search-users.cjs -- find X accounts for a company via X user search

USAGE
    node scripts/x-search-users.cjs "<query>" ["<query>"...]

DESCRIPTION
    Connects to a running Chromium over CDP, runs X's user search for each
    query (https://x.com/search?q=...&f=user), and prints the top account
    hrefs. Use this when a source gives you a handle that does not exist
    or does not match the firm - search the company name to surface the
    real official account (verified 2026-08-13: found @TSMCinJapan,
    @GoAppier, @ViduAI_official this way).

    Output is hrefs only (the UserCell name/bio selectors vary with the
    X UI); follow up with probe-bios.cjs on the candidates to confirm
    identity and activity.

OPTIONS
    -h, --help   show this help and exit

EXAMPLES
    node scripts/x-search-users.cjs "TSMC"
    node scripts/x-search-users.cjs "Appier" "iKala" "Vidu"

SEE ALSO
    verify-handles.cjs, probe-bios.cjs`;

const QUERIES = process.argv.slice(2).filter(a => a !== '--help' && a !== '-h');

if (QUERIES.length === 0 || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(USAGE);
  process.exit(process.argv.includes('--help') || process.argv.includes('-h') ? 0 : 1);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  for (const q of QUERIES) {
    try {
      await page.goto(`https://x.com/search?q=${encodeURIComponent(q)}&f=user`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(5000);
      const results = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('[data-testid="UserCell"]').forEach(cell => {
          const name = cell.querySelector('[data-testid="User-Name"]')?.innerText?.slice(0, 60) || '';
          const bio = cell.querySelector('[data-testid="UserDescription"]')?.innerText?.slice(0, 100) || '';
          const href = cell.querySelector('a[href^="/"]')?.getAttribute('href') || '';
          out.push({ name: name.replace(/\n/g, ' '), href, bio: bio.replace(/\n/g, ' ') });
        });
        return out.slice(0, 5);
      });
      console.log('=== ' + q + ' ===');
      for (const r of results) console.log('  ' + r.href + ' | ' + r.name + ' | ' + r.bio);
      if (!results.length) console.log('  (no results)');
    } catch (e) { console.log('=== ' + q + ' === ERROR ' + String(e).slice(0, 80)); }
  }
  await page.close();
  await browser.close();
})();
