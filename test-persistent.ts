import { chromium } from 'playwright';
import path from 'path';

const AUTH_DIR = path.join(process.cwd(), 'auth-data');

async function testPersistentContext() {
  console.log('Testing Playwright persistent context...');
  console.log(`Auth directory: ${AUTH_DIR}`);
  
  // Launch with persistent context (will create auth-data dir)
  const context = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: true,
  });
  
  const page = context.pages()[0] || await context.newPage();
  
  console.log('Navigating to X...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const url = page.url();
  console.log(`Current URL: ${url}`);
  
  // Check if logged in
  const isLoggedIn = await page.isVisible('[data-testid="SideNav_AccountSwitcher_Button"]').catch(() => false);
  
  if (isLoggedIn) {
    console.log('✅ Logged in via persistent context!');
  } else if (url.includes('login')) {
    console.log('❌ Not logged in - redirected to login page');
    console.log('Would need manual login first with headless: false');
  } else {
    console.log('⚠️ Unknown state');
    console.log('Page title:', await page.title());
  }
  
  await context.close();
}

testPersistentContext().catch(console.error);
