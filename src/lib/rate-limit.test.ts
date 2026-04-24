import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, rateLimiters, getIdentifier, createRateLimitHeaders } from './rate-limit';
import { NextRequest } from 'next/server';

describe('Rate Limiting', () => {
  describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      // Create a test limiter: 5 requests per 1 second
      limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5,
      });
    });

    it('should allow requests under the limit', () => {
      const id = 'test-user';

      for (let i = 0; i < 5; i++) {
        const result = limiter.isAllowed(id);
        expect(result.allowed).toBe(true);
        expect(result.info.remaining).toBe(4 - i);
      }
    });

    it('should block requests over the limit', () => {
      const id = 'test-user';

      // Make 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(id);
      }

      // 6th request should be blocked
      const result = limiter.isAllowed(id);
      expect(result.allowed).toBe(false);
      expect(result.info.remaining).toBe(0);
    });

    it('should track different identifiers separately', () => {
      const id1 = 'user-1';
      const id2 = 'user-2';

      // Max out user-1
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(id1);
      }

      // User-1 should be blocked
      expect(limiter.isAllowed(id1).allowed).toBe(false);

      // User-2 should still have full quota
      const result = limiter.isAllowed(id2);
      expect(result.allowed).toBe(true);
      expect(result.info.remaining).toBe(4);
    });

    it('should reset after window expires', async () => {
      const id = 'test-user';

      // Max out the limit
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(id);
      }

      expect(limiter.isAllowed(id).allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      const result = limiter.isAllowed(id);
      expect(result.allowed).toBe(true);
    });

    it('should provide correct rate limit headers info', () => {
      const id = 'test-user';
      const result = limiter.isAllowed(id);

      expect(result.info.limit).toBe(5);
      expect(result.info.remaining).toBe(4);
      expect(result.info.resetTime).toBeGreaterThan(Date.now());
    });
  });

  describe('getIdentifier', () => {
    it('should return IP from x-forwarded-for header', () => {
      const req = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      const id = getIdentifier(req);
      expect(id).toBe('192.168.1.1');
    });

    it('should return "unknown" when no IP headers present', () => {
      const req = new Request('http://localhost');

      const id = getIdentifier(req);
      expect(id).toBe('unknown');
    });

    it('should combine IP with userId when provided', () => {
      const req = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const id = getIdentifier(req, 'user-123');
      expect(id).toBe('192.168.1.1:user-123');
    });
  });

  describe('createRateLimitHeaders', () => {
    it('should create correct headers', () => {
      const resetTime = Date.now() + 60000; // 1 minute from now
      const info = {
        limit: 10,
        remaining: 5,
        resetTime,
      };

      const headers = createRateLimitHeaders(info);

      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('5');
      expect(headers['X-RateLimit-Reset']).toBe(String(Math.ceil(resetTime / 1000)));
    });
  });

  describe('Pre-configured rate limiters', () => {
    it('should have llm limiter with strict settings', () => {
      // Test that llm limiter exists and works
      const id = 'test-llm';

      for (let i = 0; i < 10; i++) {
        expect(rateLimiters.llm.isAllowed(id).allowed).toBe(true);
      }

      expect(rateLimiters.llm.isAllowed(id).allowed).toBe(false);
    });

    it('should have auth limiter with very strict settings', () => {
      const id = 'test-auth';

      for (let i = 0; i < 5; i++) {
        expect(rateLimiters.auth.isAllowed(id).allowed).toBe(true);
      }

      expect(rateLimiters.auth.isAllowed(id).allowed).toBe(false);
    });

    it('should have api limiter with moderate settings', () => {
      const id = 'test-api';
      let allowed = 0;

      // Make many requests
      for (let i = 0; i < 100; i++) {
        if (rateLimiters.api.isAllowed(id).allowed) {
          allowed++;
        }
      }

      // Should allow 60 requests
      expect(allowed).toBe(60);
    });
  });
});
