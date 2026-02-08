#!/usr/bin/env node
import { Command } from 'commander';
import { chromium, BrowserContext, Page, Cookie } from 'playwright';
import fs from 'fs';
import path from 'path';

const program = new Command();
const AUTH_FILE = path.join(process.cwd(), 'auth.json');

// Use Python script with browser-cookie3 for robust cookie extraction
import { execSync } from 'child_process';

program
  .name('x-list-manager')
  .description('CLI to manage X/Twitter lists using your Chrome cookies')
  .version('1.0.0');

interface BrowserSession {
  browser: any;
  context: BrowserContext;
  page: Page;
}

// Extract cookies using browser-cookie3 via Python
async function extractChromeCookies(): Promise<Cookie[]> {
  console.log('Extracting cookies from Chrome using browser-cookie3 (Python)...');
  
  const pythonScript = path.join(process.cwd(), 'get_cookies.py');
  const venvPython = path.join(process.cwd(), '.venv/bin/python3');
  
  // Use venv python if available, otherwise fallback to system python
  const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';

  try {
      const output = execSync(`${pythonCmd} ${pythonScript}`, { encoding: 'utf-8' });
      const rawCookies = JSON.parse(output.trim());
      
      const cookies: Cookie[] = rawCookies.map((c: any) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires || -1,
          httpOnly: c.httpOnly || false,
          secure: c.secure || false,
          sameSite: 'Lax' // Default
      }));
      
      console.log(`Found ${cookies.length} cookies for X/Twitter`);
      return cookies;
  } catch (error) {
      console.error('Failed to run python script:', error);
      return [];
  }
}

async function getContext(headless: boolean = true): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  
  // Try to load saved auth or extract from Chrome
  if (fs.existsSync(AUTH_FILE)) {
    // console.log('Loading saved auth state...');
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    await context.addCookies(state.cookies || []);
  } else {
    // Extract cookies from Chrome
    const cookies = await extractChromeCookies();
    if (cookies.length === 0) {
        console.warn("No cookies found! You might need to log in to X in Chrome first.");
    }
    await context.addCookies(cookies);
    
    // Save for future runs
    const state = { cookies };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
    console.log('Saved cookies to auth.json');
  }
  
  const page = await context.newPage();
  return { browser, context, page };
}

async function closeSession(session: BrowserSession) {
  await session.browser.close();
}

async function ensureLoggedIn(page: Page): Promise<boolean> {
  // Try checking without full nav first if possible
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
  
  try {
      await page.waitForTimeout(2000);
      const url = page.url();
      if (url.includes('login') || url === 'https://x.com/' || url === 'https://x.com') {
        const isLoggedIn = await page.isVisible('[data-testid="SideNav_AccountSwitcher_Button"]');
        return isLoggedIn;
      }
      return true;
  } catch (e) {
      return false;
  }
}

program
  .command('refresh')
  .description('Re-extract cookies from Chrome (run if login expired)')
  .action(async () => {
    console.log('Refreshing cookies from Chrome...');
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
    const cookies = await extractChromeCookies();
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies }, null, 2));
    console.log('✅ Cookies refreshed and saved to auth.json');
    console.log(`Total cookies: ${cookies.length}`);
  });

program
  .command('check')
  .description('Check if logged into X')
  .action(async () => {
    console.log('Checking X login status...');
    const session = await getContext(true);
    
    try {
      const loggedIn = await ensureLoggedIn(session.page);
      if (loggedIn) {
        console.log('✅ Logged into X!');
      } else {
        console.log('❌ Not logged in. Try: npx tsx cli.ts refresh');
      }
    } catch (e) {
        console.error("Check failed:", e);
    } finally {
      await closeSession(session);
    }
  });

program
  .command('add')
  .argument('<listName>', 'Name of the list to add to')
  .argument('<handles...>', 'User handles (e.g. @elonmusk @jack)')
  .option('--no-headless', 'Run in headed mode (visible browser)')
  .action(async (listName, handles, options) => {
    const headless = options.headless !== false;
    const targetHandles = (Array.isArray(handles) ? handles : [handles]).map((h: string) => h.startsWith('@') ? h.substring(1) : h);
    
    console.log(`Adding ${targetHandles.length} account(s) to "${listName}"...`);
    
    const results: { handle: string; status: 'added' | 'already' | 'error'; error?: string }[] = [];
    
    for (const targetHandle of targetHandles) {
    
    const session = await getContext(headless);
    
    try {
      if (!await ensureLoggedIn(session.page)) {
        console.error('Not logged in. Run: npx tsx cli.ts refresh');
        process.exit(1);
      }

      console.log(`Navigating to profile: https://x.com/${targetHandle}`);
      await session.page.goto(`https://x.com/${targetHandle}`, { waitUntil: 'domcontentloaded' });
      
      console.log('Waiting for user actions button...');
      try {
        await session.page.waitForSelector('[data-testid="userActions"]', { timeout: 15000 });
      } catch (e) {
        console.error(`User @${targetHandle} not found (timeout).`);
        console.log('Page content:', await session.page.locator('body').innerText());
        await session.page.screenshot({ path: 'user_not_found.png' });
        process.exit(1);
      }

      console.log('Clicking user actions...');
      await session.page.click('[data-testid="userActions"]');
      await session.page.waitForTimeout(500);
      
      console.log('Clicking Add/remove from Lists...');
      try {
        await session.page.click('[role="menuitem"]:has-text("Add/remove from Lists")', { timeout: 5000 });
      } catch (e) {
        console.log('Trying fallback selector...');
        try {
            await session.page.click('[role="menuitem"]:has-text("Lists")', { timeout: 5000 });
        } catch (e2) {
            console.error('Menu items found:', await session.page.locator('[role="menuitem"]').allInnerTexts());
            const menuItems = await session.page.locator('[role="menuitem"]').all();
            for (let i = 0; i < menuItems.length; i++) {
                console.log(`Menu item ${i} HTML:`, await menuItems[i].evaluate(el => el.outerHTML));
            }
            await session.page.screenshot({ path: 'menu_error.png' });
            throw e2;
        }
      }

      console.log('Waiting for list dialog...');
      // Use specific selector and ensure it is visible (fixes duplicate dialog issue)
      const dialogSelector = '[role="dialog"]:has(div[role="checkbox"]):visible';
      await session.page.waitForSelector(dialogSelector, { timeout: 10000 });
      
      console.log(`Searching for list: "${listName}"`);
      const listLocator = session.page.locator(`${dialogSelector} div[role="checkbox"]:has-text("${listName}")`);
      
      if (await listLocator.count() === 0) {
        console.error(`List "${listName}" not found.`);
        process.exit(1);
      }
      
      const isChecked = await listLocator.getAttribute('aria-checked') === 'true';
      
      if (isChecked) {
        console.log(`✓ @${targetHandle} already in "${listName}".`);
      } else {
        await listLocator.click();
        console.log(`✓ Added @${targetHandle} to "${listName}".`);
      }
      
      const saveButton = session.page.locator(`${dialogSelector} [role="button"]:has-text("Save")`);
      const isDisabled = await saveButton.getAttribute('aria-disabled') === 'true';
      
      if (!isDisabled) {
        await saveButton.click();
        console.log('Saved.');
      } else {
        console.log('No changes needed.');
        await session.page.keyboard.press('Escape');
      }

    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    } finally {
      await closeSession(session);
    }
    }
  });

program
  .command('remove')
  .argument('<handle>', 'User handle')
  .argument('<listName>', 'Name of the list')
  .option('--no-headless', 'Run in headed mode')
  .action(async (handle, listName, options) => {
    const headless = options.headless !== false;
    const targetHandle = handle.startsWith('@') ? handle.substring(1) : handle;
    console.log(`Removing @${targetHandle} from "${listName}"...`);
    
    const session = await getContext(headless);
    
    try {
      if (!await ensureLoggedIn(session.page)) {
        console.error('Not logged in. Run: npx tsx cli.ts refresh');
        process.exit(1);
      }

      await session.page.goto(`https://x.com/${targetHandle}`, { waitUntil: 'domcontentloaded' });
      await session.page.waitForSelector('[data-testid="userActions"]', { timeout: 10000 });

      await session.page.click('[data-testid="userActions"]');
      await session.page.waitForTimeout(500);
      await session.page.click('[role="menuitem"]:has-text("Add/remove from Lists")');

      const dialogSelector = '[role="dialog"]:has(div[role="checkbox"]):visible';
      await session.page.waitForSelector(dialogSelector, { timeout: 10000 });
      
      const listLocator = session.page.locator(`${dialogSelector} div[role="checkbox"]:has-text("${listName}")`);
      
      if (await listLocator.count() === 0) {
        console.error(`List "${listName}" not found.`);
        process.exit(1);
      }
      
      const isChecked = await listLocator.getAttribute('aria-checked') === 'true';
      
      if (!isChecked) {
        console.log(`✓ @${targetHandle} not in "${listName}".`);
      } else {
        await listLocator.click();
        console.log(`✓ Removed @${targetHandle} from "${listName}".`);
      }
      
      const saveButton = session.page.locator(`${dialogSelector} [role="button"]:has-text("Save")`);
      const isDisabled = await saveButton.getAttribute('aria-disabled') === 'true';
      
      if (!isDisabled) {
        await saveButton.click();
        console.log('Saved.');
      } else {
        console.log('No changes needed.');
        await session.page.keyboard.press('Escape');
      }

    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    } finally {
      await closeSession(session);
    }
  });

program
  .command('list')
  .description('List your X lists')
  .option('--no-headless', 'Run in headed mode')
  .action(async (options) => {
    const headless = options.headless !== false;
    console.log('Fetching your lists...');
    const session = await getContext(headless);

    try {
      if (!await ensureLoggedIn(session.page)) {
        console.error('Not logged in. Run: npx tsx cli.ts refresh');
        process.exit(1);
      }
      
      console.log('Logged in successfully.');
      await session.page.waitForSelector('[data-testid="AppTabBar_Profile_Link"]');
      const profileLink = await session.page.getAttribute('[data-testid="AppTabBar_Profile_Link"]', 'href');
      const username = profileLink?.split('/')[1];
      console.log(`Detected username: ${username}`);
      
      if (!username) {
        throw new Error('Could not determine username');
      }

      console.log(`Navigating to lists: https://x.com/${username}/lists`);
      await session.page.goto(`https://x.com/${username}/lists`, { waitUntil: 'domcontentloaded' });
      console.log('Waiting for list items...');
      try {
        await session.page.waitForSelector('[data-testid="cellInnerDiv"]', { timeout: 10000 });
      } catch (e) {
        console.log('Timeout waiting for lists. Taking screenshot...');
        await session.page.screenshot({ path: 'lists_error.png' });
        throw e;
      }
      
      const listItems = session.page.locator('[data-testid="cellInnerDiv"]');
      const count = await listItems.count();
      
      console.log(`\nYour lists:`);
      
      for (let i = 0; i < count; i++) {
        const text = await listItems.nth(i).innerText();
        const lines = text.split('\n');
        if (lines.length > 0 && lines[0].trim() && !lines[0].includes('Pinned')) {
          console.log(`  - ${lines[0]}`);
        }
      }

    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    } finally {
      await closeSession(session);
    }
  });

program
  .command('batch')
  .description('Batch add multiple accounts to lists from JSON file')
  .argument('<file>', 'JSON file with accounts (format: {"List Name": ["@handle1", "@handle2"]})')
  .option('--no-headless', 'Run in headed mode')
  .action(async (filePath, options) => {
    const headless = options.headless !== false;
    
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    
    let batchData: Record<string, string[]>;
    try {
      batchData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error('Invalid JSON file:', e);
      process.exit(1);
    }
    
    const results: { listName: string; handle: string; status: 'added' | 'already' | 'error'; error?: string }[] = [];
    
    // Process each list
    for (const [listName, handles] of Object.entries(batchData)) {
      console.log(`\nProcessing "${listName}" (${handles.length} accounts)...`);
      
      for (const handle of handles) {
        const targetHandle = handle.startsWith('@') ? handle.substring(1) : handle;
        
        // One session per add to avoid state issues
        const session = await getContext(headless);
        try {
          if (!await ensureLoggedIn(session.page)) {
            results.push({ listName, handle: targetHandle, status: 'error', error: 'Not logged in' });
            continue;
          }
          
          await session.page.goto(`https://x.com/${targetHandle}`, { waitUntil: 'domcontentloaded' });
          
          try {
            await session.page.waitForSelector('[data-testid="userActions"]', { timeout: 10000 });
          } catch (e) {
            console.error(`  ❌ @${targetHandle}: Not found`);
            results.push({ listName, handle: targetHandle, status: 'error', error: 'User not found' });
            continue;
          }
          
          await session.page.click('[data-testid="userActions"]');
          await session.page.waitForTimeout(500);
          await session.page.click('[role="menuitem"]:has-text("Add/remove from Lists")');
          
          const dialogSelector = '[role="dialog"]:has(div[role="checkbox"]):visible';
          await session.page.waitForSelector(dialogSelector, { timeout: 10000 });
          
          const listLocator = session.page.locator(`${dialogSelector} div[role="checkbox"]:has-text("${listName}")`);
          
          if (await listLocator.count() === 0) {
            console.error(`  ❌ List "${listName}" not found`);
            results.push({ listName, handle: targetHandle, status: 'error', error: 'List not found' });
            continue;
          }
          
          const isChecked = await listLocator.getAttribute('aria-checked') === 'true';
          
          if (!isChecked) {
             await listLocator.click();
          }
          
          const saveButton = session.page.locator(`${dialogSelector} [role="button"]:has-text("Save")`);
          const isDisabled = await saveButton.getAttribute('aria-disabled') === 'true';

          if (!isDisabled) {
            await saveButton.click();
            console.log(`  ✅ @${targetHandle}: Added`);
            results.push({ listName, handle: targetHandle, status: 'added' });
          } else {
            console.log(`  ⚠ @${targetHandle}: Already in list`);
            results.push({ listName, handle: targetHandle, status: 'already' });
            await session.page.keyboard.press('Escape');
          }
          
        } catch (error) {
          console.error(`  ❌ @${targetHandle}: Error - ${error}`);
          results.push({ listName, handle: targetHandle, status: 'error', error: String(error) });
        } finally {
          await closeSession(session);
        }
        
        // Small delay between accounts to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    // Summary
    const added = results.filter(r => r.status === 'added').length;
    const already = results.filter(r => r.status === 'already').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`\n=== BATCH COMPLETE ===`);
    console.log(`Added: ${added} | Already in: ${already} | Errors: ${errors}`);
    
    if (errors > 0) {
      console.log('\nFailed:');
      results.filter(r => r.status === 'error').forEach(r => {
        console.log(`  - @${r.handle}: ${r.error}`);
      });
      process.exit(1);
    }
  });

program.parse();
