#!/usr/bin/env node
import { Command } from 'commander';
import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'node:fs';

const program = new Command();

// Attach to the LIVE system Chromium via CDP (same pattern as
// x-publisher.py in ~/av/bin/hydra/publish). No cookie extraction, no
// separate browser instance -- the X login state is the real browser
// session. Chromium must be running with --remote-debugging-port=9222:
//   open -a Chromium --args --remote-debugging-port=9222 --no-first-run
// Override the CDP endpoint with XLM_CDP_URL.
const CDP_URL = process.env.XLM_CDP_URL || 'http://localhost:9222';

program
  .name('x-list-manager')
  .description('CLI to manage X/Twitter lists via live Chromium CDP')
  .version('1.0.0');

interface BrowserSession {
  browser: import('playwright').Browser;
  context: BrowserContext;
  page: Page;
}

async function getContext(headless: boolean = true): Promise<BrowserSession> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  // Use the profile-bound context (has the persisted X session cookies).
  // A fresh newContext() has NO cookies -- it does not inherit the profile.
  const context = browser.contexts()[0] || await browser.newContext();
  // Always create a FRESH page. Reusing an existing page risks
  // "navigation interrupted by another navigation" -- a leftover page from a
  // killed run may still be navigating, and SPA routing on X fights a goto.
  // A new page in the SAME context inherits the session cookies.
  const page = await context.newPage();
  return { browser, context, page };
}

async function closeSession(session: BrowserSession) {
  // Close the tab we created, then detach the CDP connection WITHOUT closing
  // the user's live Chromium. browser.close() on a connectOverCDP browser
  // only disconnects the websocket; it does NOT terminate the browser
  // process. Required so the Node process exits (otherwise the open
  // websocket keeps it alive).
  try { await session.page.close(); } catch { /* already closed */ }
  await session.browser.close();
}

// Human-like pacing. Fixed computer-speed delays are a bot-detection
// pattern; X watches for uniform action cadence. All waits are random
// within a range so the pattern is non-uniform, like a real person
// reading profiles, hesitating, and clicking.
function humanDelay(page: Page, minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return page.waitForTimeout(ms);
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
  .command('create')
  .description('Create a new X list')
  .argument('<listName>', 'Name of the list to create')
  .option('-d, --description <text>', 'List description')
  .option('-p, --private', 'Make the list private')
  .option('--no-headless', 'Run in headed mode (visible browser)')
  .action(async (listName, options) => {
    const headless = options.headless !== false;
    const session = await getContext(headless);

    try {
      if (!await ensureLoggedIn(session.page)) {
        console.error('Not logged in. Run: npx tsx scripts/cli.ts check --no-headless and log in');
        process.exit(1);
      }

      console.log(`Creating list "${listName}"...`);
      await session.page.goto('https://x.com/i/lists/create', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await session.page.waitForTimeout(2500);

      await session.page.fill('input[name="name"]', listName);
      if (options.description) {
        await session.page.fill('textarea[name="description"]', options.description);
      }
      if (options.private) {
        await session.page.locator('input[type="checkbox"]').first().click();
      }
      await session.page.waitForTimeout(400);

      const nextBtn = session.page.getByRole('button', { name: 'Next', exact: true });
      await nextBtn.click();
      // After Next, X redirects to /i/lists/<id>/members/suggested -- the
      // list is created at this point; the ID is captured from the URL.
      await session.page.waitForURL(/\/i\/lists\/\d+/, { timeout: 20000 });

      const m = session.page.url().match(/\/i\/lists\/(\d+)/);
      const listId = m ? m[1] : 'unknown';
      console.log(`✅ Created list "${listName}": https://x.com/i/lists/${listId}`);

      // X then opens "Add to your List" (suggested members) -- the list is
      // already created; close the flow with Done so the script does not
      // linger on the member-add form. Best-effort: if Done is missing the
      // list still exists, so never fail here.
      try {
        await session.page.getByRole('button', { name: 'Done', exact: true }).click();
        await session.page.waitForTimeout(800);
      } catch {
        // ignore -- list creation already succeeded
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    } finally {
      await closeSession(session);
    }
  });

program
  .command('delete')
  .description('Delete an X list')
  .argument('<listIdOrUrl>', 'List ID or full list URL (e.g. 1234567890 or https://x.com/i/lists/1234567890)')
  .option('--no-headless', 'Run in headed mode (visible browser)')
  .action(async (listIdOrUrl, options) => {
    const headless = options.headless !== false;
    const session = await getContext(headless);

    try {
      if (!await ensureLoggedIn(session.page)) {
        console.error('Not logged in. Run: npx tsx scripts/cli.ts check --no-headless and log in');
        process.exit(1);
      }

      // Accept a bare ID or a full URL; normalize to /i/lists/<id>/info
      const m = String(listIdOrUrl).match(/(\d+)/);
      if (!m) {
        console.error(`Could not parse list ID from: ${listIdOrUrl}`);
        process.exit(1);
      }
      const listId = m[1];
      const infoUrl = `https://x.com/i/lists/${listId}/info`;
      console.log(`Opening ${infoUrl} ...`);
      await session.page.goto(infoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await session.page.waitForTimeout(2500);

      // Click "Edit List" (link in the list header) to open the edit dialog
      await session.page.getByRole('link', { name: 'Edit List' }).first().click();
      await session.page.waitForTimeout(2000);

      // In the edit dialog: click "Delete List"
      await session.page.getByText('Delete List', { exact: true }).first().click();
      await session.page.waitForTimeout(1500);

      // Confirmation sheet: role="alertdialog" (NOT "dialog") "Delete List?
      // This can't be undone..." with a Delete button carrying
      // data-testid="confirmationSheetConfirm". Verified live 2026-08-12
      // via the observe recorder. The alertdialog element reports a
      // zero-size rect -- wait on the BUTTON, not the dialog.
      await session.page.locator('[data-testid="confirmationSheetConfirm"]').click();
      await session.page.waitForTimeout(2500);

      console.log(`✅ Deleted list ${listId}`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    } finally {
      await closeSession(session);
    }
  });

program
  .command('refresh')
  .description('Verify the live Chromium CDP connection is up (run Chromium with --remote-debugging-port=9222)')
  .action(async () => {
    const session = await getContext(true);
    await closeSession(session);
    console.log('CDP connection OK. Chromium is reachable at', CDP_URL);
  });

program
  .command('check')
  .description('Check if logged into X')
  .option('--no-headless', 'Run in headed mode (visible browser; use for first-time login)')
  .action(async (options) => {
    const headless = options.headless !== false;
    console.log('Checking X login status...');
    const session = await getContext(headless);
    
    try {
      const loggedIn = await ensureLoggedIn(session.page);
      if (loggedIn) {
        console.log('✅ Logged into X!');
      } else {
        console.log('❌ Not logged in. First time: run `npx tsx scripts/cli.ts check --no-headless` and log in.');
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
        console.error('Not logged in. Run: npx tsx scripts/cli.ts check --no-headless and log in');
        process.exit(1);
      }

      console.log(`Navigating to profile: https://x.com/${targetHandle}`);
      await session.page.goto(`https://x.com/${targetHandle}`, { waitUntil: 'domcontentloaded' });
      
      // Let the profile render like a human who just typed a URL
      await humanDelay(session.page, 2000, 4000);

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
      // The dropdown animates in; X's menu can take 1-2s to render.
      // Wait for the actual item rather than a fixed delay.
      await humanDelay(session.page, 500, 1000);
      
      console.log('Clicking Add/remove from Lists...');
      try {
        await session.page.waitForSelector('[role="menuitem"]:has-text("Add/remove from Lists")', { timeout: 8000 });
        await session.page.click('[role="menuitem"]:has-text("Add/remove from Lists")');
      } catch (e) {
        console.log('Trying fallback selector...');
        try {
            await session.page.waitForSelector('[role="menuitem"]:has-text("Lists")', { timeout: 8000 });
            await session.page.click('[role="menuitem"]:has-text("Lists")');
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
      await humanDelay(session.page, 600, 1200);
      
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
        await humanDelay(session.page, 300, 800);
        await listLocator.click();
        console.log(`✓ Added @${targetHandle} to "${listName}".`);
      }
      
      const saveButton = session.page.locator(`${dialogSelector} [role="button"]:has-text("Save")`);
      const isDisabled = await saveButton.getAttribute('aria-disabled') === 'true';
      
      if (!isDisabled) {
        await humanDelay(session.page, 500, 1000);
        await saveButton.click();
        console.log('Saved.');
        // Give the save time to register before moving on
        await humanDelay(session.page, 1200, 2200);
      } else {
        console.log('No changes needed.');
        await session.page.keyboard.press('Escape');
      }
      
      // Human pause between profiles: the user reads the profile, thinks,
      // decides. Long random gap -- the single strongest anti-bot signal.
      const isLast = targetHandle === targetHandles[targetHandles.length - 1];
      if (!isLast) {
        console.log(`Pausing between profiles...`);
        await humanDelay(session.page, 6000, 14000);
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
        console.error('Not logged in. Run: npx tsx scripts/cli.ts check --no-headless and log in');
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
        console.error('Not logged in. Run: npx tsx scripts/cli.ts check --no-headless and log in');
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
