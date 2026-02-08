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
 * Extract X/Twitter cookies from Chrome's cookie store
 * Requires Chrome to be closed (or at least cookies not locked)
 */
export async function getXCookies(): Promise<XCookie> {
  const result = await getCookies({
    browser: 'chrome',
    url: 'https://x.com'
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

