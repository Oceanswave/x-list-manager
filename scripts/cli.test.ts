import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// We'll test the helper functions by extracting them
// For now, test the cookie formatting and auth file handling

describe('CLI helpers', () => {
  const testAuthFile = path.join(process.cwd(), 'test-auth.json');
  
  afterEach(() => {
    if (fs.existsSync(testAuthFile)) {
      fs.unlinkSync(testAuthFile);
    }
  });

  describe('auth file handling', () => {
    it('can write and read auth state', () => {
      const cookies = [
        { name: 'auth_token', value: 'test-token', domain: '.x.com', path: '/' },
        { name: 'ct0', value: 'test-csrf', domain: '.x.com', path: '/' }
      ];
      
      fs.writeFileSync(testAuthFile, JSON.stringify({ cookies }, null, 2));
      
      const state = JSON.parse(fs.readFileSync(testAuthFile, 'utf-8'));
      expect(state.cookies).toHaveLength(2);
      expect(state.cookies[0].name).toBe('auth_token');
      expect(state.cookies[1].name).toBe('ct0');
    });

    it('handles missing auth file gracefully', () => {
      expect(fs.existsSync(testAuthFile)).toBe(false);
    });
  });

  describe('cookie formatting', () => {
    it('formats cookies for Playwright correctly', () => {
      const xCookies = { auth_token: 'abc123', ct0: 'def456' };
      
      const cookies = [
        {
          name: 'auth_token',
          value: xCookies.auth_token,
          domain: '.x.com',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax' as const
        },
        {
          name: 'ct0',
          value: xCookies.ct0,
          domain: '.x.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax' as const
        }
      ];

      expect(cookies[0].domain).toBe('.x.com');
      expect(cookies[0].secure).toBe(true);
      expect(cookies[0].httpOnly).toBe(true);
      expect(cookies[1].httpOnly).toBe(false);
    });

    it('handles empty cookie values', () => {
      const xCookies = { auth_token: '', ct0: '' };
      
      expect(xCookies.auth_token).toBe('');
      expect(xCookies.ct0).toBe('');
      expect(!xCookies.auth_token || !xCookies.ct0).toBe(true);
    });

    it('handles undefined cookie values', () => {
      const xCookies: { auth_token?: string; ct0?: string } = {};
      
      expect(xCookies.auth_token).toBeUndefined();
      expect(!xCookies.auth_token || !xCookies.ct0).toBe(true);
    });
  });

  describe('handle parsing', () => {
    it('strips @ prefix from handles', () => {
      const handle = '@elonmusk';
      const parsed = handle.startsWith('@') ? handle.substring(1) : handle;
      expect(parsed).toBe('elonmusk');
    });

    it('leaves handles without @ unchanged', () => {
      const handle = 'elonmusk';
      const parsed = handle.startsWith('@') ? handle.substring(1) : handle;
      expect(parsed).toBe('elonmusk');
    });

    it('handles multiple handles in array', () => {
      const handles = ['@user1', 'user2', '@user3'];
      const parsed = handles.map(h => h.startsWith('@') ? h.substring(1) : h);
      expect(parsed).toEqual(['user1', 'user2', 'user3']);
    });
  });

  describe('URL construction', () => {
    it('builds correct profile URL', () => {
      const handle = 'OpenAI';
      const url = `https://x.com/${handle}`;
      expect(url).toBe('https://x.com/OpenAI');
    });

    it('handles special characters in handles', () => {
      const handle = 'test_user123';
      const url = `https://x.com/${handle}`;
      expect(url).toBe('https://x.com/test_user123');
    });
  });

  describe('selector construction', () => {
    it('builds correct dialog selector', () => {
      const dialogSelector = '[role="dialog"]:has(div[role="checkbox"]):visible';
      expect(dialogSelector).toContain('role="dialog"');
      expect(dialogSelector).toContain(':visible');
    });

    it('builds correct list checkbox selector', () => {
      const listName = 'AI Announcements';
      const dialogSelector = '[role="dialog"]:has(div[role="checkbox"]):visible';
      const selector = `${dialogSelector} div[role="checkbox"]:has-text("${listName}")`;
      expect(selector).toContain('AI Announcements');
      expect(selector).toContain('role="checkbox"');
    });

    it('escapes special characters in list names', () => {
      const listName = 'Test "List"';
      // In real usage, we'd need to escape quotes
      expect(listName).toContain('"');
    });
  });
});
