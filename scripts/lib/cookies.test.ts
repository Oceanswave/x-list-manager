import { describe, it, expect, vi } from 'vitest';
import { getXCookies, isLoggedIn } from './cookies.js';

// Mock sweet-cookie
vi.mock('@steipete/sweet-cookie', () => ({
  getCookies: vi.fn()
}));

import { getCookies } from '@steipete/sweet-cookie';
const mockGetCookies = vi.mocked(getCookies);

describe('cookies', () => {
  describe('getXCookies', () => {
    it('extracts auth_token and ct0 from Chrome cookies', async () => {
      mockGetCookies.mockResolvedValue({
        cookies: [
          { name: 'auth_token', value: 'test-auth-token' },
          { name: 'ct0', value: 'test-ct0' },
          { name: 'other_cookie', value: 'ignored' }
        ],
        warnings: []
      });

      const result = await getXCookies();

      expect(result.auth_token).toBe('test-auth-token');
      expect(result.ct0).toBe('test-ct0');
      expect(mockGetCookies).toHaveBeenCalledWith({
        browser: 'chrome',
        url: 'https://x.com'
      });
    });

    it('returns empty object when cookies not found', async () => {
      mockGetCookies.mockResolvedValue({
        cookies: [],
        warnings: ['No cookies found']
      });

      const result = await getXCookies();

      expect(result.auth_token).toBeUndefined();
      expect(result.ct0).toBeUndefined();
    });

    it('handles partial cookies (only auth_token)', async () => {
      mockGetCookies.mockResolvedValue({
        cookies: [
          { name: 'auth_token', value: 'only-auth' }
        ],
        warnings: []
      });

      const result = await getXCookies();

      expect(result.auth_token).toBe('only-auth');
      expect(result.ct0).toBeUndefined();
    });
  });

  describe('isLoggedIn', () => {
    it('returns true when both cookies present', async () => {
      mockGetCookies.mockResolvedValue({
        cookies: [
          { name: 'auth_token', value: 'token' },
          { name: 'ct0', value: 'csrf' }
        ],
        warnings: []
      });

      expect(await isLoggedIn()).toBe(true);
    });

    it('returns false when auth_token missing', async () => {
      mockGetCookies.mockResolvedValue({
        cookies: [
          { name: 'ct0', value: 'csrf' }
        ],
        warnings: []
      });

      expect(await isLoggedIn()).toBe(false);
    });

    it('returns false when ct0 missing', async () => {
      mockGetCookies.mockResolvedValue({
        cookies: [
          { name: 'auth_token', value: 'token' }
        ],
        warnings: []
      });

      expect(await isLoggedIn()).toBe(false);
    });

    it('returns false on error', async () => {
      mockGetCookies.mockRejectedValue(new Error('Chrome locked'));

      expect(await isLoggedIn()).toBe(false);
    });
  });
});
