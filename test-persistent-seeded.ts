import { chromium, Cookie } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.join(process.cwd(), 'auth-data-seeded');

async function extractAndSeed() {
  console.log('Extracting cookies via browser-cookie3...');
  
  const pythonScript = path.join(process.cwd(), 'scripts', 'get_cookies.py');
  const output = execSync(`python3 ${pythonScript}`, { encoding: 'utf-8' });
  const rawCookies = JSON.parse(output.trim());
  
  const cookies: Cookie[] = rawCookies.map((c: any) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires || -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: 'Lax' as const
  }));
  
  console.log(`Extracted ${cookies.length} cookies`);
  
  // Clean up old auth dir
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true });
  }
  
  // Launch persistent context
  console.log('Launching persistent context...');
  const context = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: true,
  });
  
  // Add cookies
  console.log('Adding cookies to context...');
  await context.addCookies(cookies);
  
  const page = context.pages()[0] || await context.newPage();
  
  console.log('Navigating to X...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const url = page.url();
  console.log(`Current URL: ${url}`);
  
  const isLoggedIn = await page.isVisible('[data-testid="SideNav_AccountSwitcher_Button"]').catch(() => false);
  
  if (isLoggedIn) {
    console.log('✅ Logged in! Persistent context + cookie seeding works!');
    console.log('Auth state saved to:', AUTH_DIR);
  } else {
    console.log('❌ Still not logged in after seeding cookies');
  }
  
  await context.close();
}

extractAndSeed().catch(console.error);
