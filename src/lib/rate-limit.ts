import { LRUCache } from 'lru-cache';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  limit: number;
}

// Simple in-memory rate limiter using LRU cache
// For production with multiple instances, use Redis (e.g., @upstash/ratelimit)
class RateLimiter {
  private cache: LRUCache<string, number[]>;
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    
    // LRU cache with TTL based on window
    this.cache = new LRUCache({
      ttl: options.windowMs,
      max: 10000, // Max 10k IPs/users in memory
    });
  }

  isAllowed(identifier: string): { allowed: boolean; info: RateLimitInfo } {
    const now = Date.now();
    const resetTime = now + this.windowMs;
    
    // Get existing timestamps for this identifier
    const timestamps = this.cache.get(identifier) || [];
    
    // Filter out old timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
    
    const remaining = Math.max(0, this.maxRequests - validTimestamps.length);
    
    if (validTimestamps.length >= this.maxRequests) {
      return {
        allowed: false,
        info: {
          remaining: 0,
          resetTime: validTimestamps[0] + this.windowMs, // Reset when oldest expires
          limit: this.maxRequests,
        },
      };
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.cache.set(identifier, validTimestamps);

    return {
      allowed: true,
      info: {
        remaining: remaining - 1,
        resetTime,
        limit: this.maxRequests,
      },
    };
  }

  reset(identifier: string): void {
    this.cache.delete(identifier);
  }
}

// Pre-configured rate limiters for different use cases
export const rateLimiters = {
  // Very strict: LLM APIs (expensive)
  llm: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  }),
  
  // Strict: Authentication endpoints
  auth: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 login attempts per minute
  }),
  
  // Moderate: General API usage
  api: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  }),
  
  // Relaxed: Health checks
  health: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 health checks per minute
  }),
};

// Get identifier from request (IP + userId if authenticated)
export function getIdentifier(req: Request, userId?: string): string {
  // Get IP from headers (works with most reverse proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  
  // Combine IP + userId for authenticated users
  // This prevents shared IP limits in corporate/VPN environments
  return userId ? `${ip}:${userId}` : ip;
}

// Helper to create rate limit response headers
export function createRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(info.limit),
    'X-RateLimit-Remaining': String(Math.max(0, info.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(info.resetTime / 1000)), // Unix timestamp
  };
}

export { RateLimiter };
export type { RateLimitOptions, RateLimitInfo };
