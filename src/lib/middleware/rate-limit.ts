import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, getIdentifier, createRateLimitHeaders as createHeaders, RateLimiter } from '@/lib/rate-limit';

// Re-export for convenience
export { createRateLimitHeaders } from '@/lib/rate-limit';

interface RateLimitMiddlewareOptions {
  limiter: RateLimiter;
  getUserId?: (req: NextRequest) => Promise<string | undefined>;
}

export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  return async function rateLimitMiddleware(
    req: NextRequest
  ): Promise<{ allowed: boolean; response?: NextResponse; info?: { remaining: number; resetTime: number; limit: number } }> {
    // Get user ID if available (for authenticated requests)
    const userId = options.getUserId ? await options.getUserId(req) : undefined;
    
    // Get identifier (IP + userId)
    const identifier = getIdentifier(req as unknown as Request, userId);
    
    // Check rate limit
    const result = options.limiter.isAllowed(identifier);
    
    if (!result.allowed) {
      const headers = createHeaders(result.info);
      
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((result.info.resetTime - Date.now()) / 1000)} seconds.`,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((result.info.resetTime - Date.now()) / 1000)),
              ...headers,
            },
          }
        ),
        info: result.info,
      };
    }
    
    return {
      allowed: true,
      info: result.info,
    };
  };
}

// Pre-built middlewares for common use cases
export const llmRateLimit = createRateLimitMiddleware({
  limiter: rateLimiters.llm,
  getUserId: async (req) => {
    // Try to get user from cookie/token
    // This is a simple check - the actual auth happens in the route
    const cookie = req.cookies.get('xase_token');
    if (!cookie) return undefined;
    // We don't verify here, just use as part of identifier
    // The route will do proper verification
    return cookie.value;
  },
});

export const authRateLimit = createRateLimitMiddleware({
  limiter: rateLimiters.auth,
});

export const apiRateLimit = createRateLimitMiddleware({
  limiter: rateLimiters.api,
  getUserId: async (req) => {
    const cookie = req.cookies.get('xase_token');
    return cookie?.value;
  },
});

export const healthRateLimit = createRateLimitMiddleware({
  limiter: rateLimiters.health,
});
