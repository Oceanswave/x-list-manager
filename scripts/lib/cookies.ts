/**
 * Cookie extraction using @steipete/sweet-cookie
 * Pure TypeScript - no Python dependency
 */
import { getCookies } from '@steipete/sweet-cookie';

export interface XCookie {
  auth_token?: string;
  ct0?: string;
}

/**
 * Extract X/Twitter cookies from the persistent Chromium profile used by
 * Playwright. The profile lives at PROFILE_DIR (default
 * ~/.config/x-list-manager/user_data) and is created on first login via
 * `npx tsx scripts/cli.ts check --no-headless`.
 *
 * NOTE: this reads cookies FROM a running profile's Cookies SQLite DB.
 * Chromium writes the DB lazily; if the returned cookies look stale,
 * close the browser and re-run, or log in again in the profile.
 */
export async function getXCookies(): Promise<XCookie> {
  const result = await getCookies({
    browser: 'chrome',
    url: 'https://x.com',
    profile: process.env.XLM_PROFILE_DIR || `${process.env.HOME}/.config/x-list-manager/user_data`
  });

  const cookies: XCookie = {};

  for (const cookie of result.cookies) {
    if (cookie.name === 'auth_token') {
      cookies.auth_token = cookie.value;
    } else if (cookie.name === 'ct0') {
      cookies.ct0 = cookie.value;
    }
  }

  return cookies;
}

/**
 * Check if we have valid X authentication cookies
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    const cookies = await getXCookies();
    return !!(cookies.auth_token && cookies.ct0);
  } catch {
    return false;
  }
}
