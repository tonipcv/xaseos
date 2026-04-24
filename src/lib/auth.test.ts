// @vitest-environment node
// Ensure JWT_SECRET is set
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!!';

import { describe, it, expect, beforeEach } from 'vitest';

describe('auth', () => {
  // Dynamic import to ensure TextEncoder polyfill is applied first
  let auth: typeof import('./auth');

  beforeEach(async () => {
    auth = await import('./auth');
  });

  describe('signToken', () => {
    it('should sign a valid JWT token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const token = await auth.signToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const token = await auth.signToken(payload);
      const verified = await auth.verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified?.sub).toBe(payload.sub);
      expect(verified?.email).toBe(payload.email);
      expect(verified?.role).toBe(payload.role);
    });

    it('should return null for invalid token', async () => {
      const verified = await auth.verifyToken('invalid-token');
      expect(verified).toBeNull();
    });
  });

  describe('createAuthCookie', () => {
    it('should create cookie with correct properties', () => {
      const cookie = auth.createAuthCookie('test-token');

      expect(cookie.name).toBe('xase_token');
      expect(cookie.value).toBe('test-token');
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.path).toBe('/');
      expect(cookie.maxAge).toBe(60 * 60 * 24 * 7); // 7 days
    });
  });

  describe('clearAuthCookie', () => {
    it('should create cleared cookie', () => {
      const cookie = auth.clearAuthCookie();

      expect(cookie.name).toBe('xase_token');
      expect(cookie.value).toBe('');
      expect(cookie.maxAge).toBe(0);
    });
  });
});
