import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken, createAuthCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { authRateLimit, createRateLimitHeaders } from '@/lib/middleware/rate-limit';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/auth/login');

export async function POST(req: NextRequest) {
  // Rate limiting check (strict for auth endpoints)
  const rateLimitResult = await authRateLimit(req);
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!;
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ sub: user.id, email: user.email, name: user.name ?? undefined, role: user.role });
    const cookie = createAuthCookie(token);

    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    res.cookies.set(cookie);

    // Add rate limit headers
    if (rateLimitResult.info) {
      const headers = createRateLimitHeaders(rateLimitResult.info);
      Object.entries(headers).forEach(([key, value]) => {
        res.headers.set(key, value as string);
      });
    }

    return res;
  } catch (err) {
    log.error({ err }, 'login failed');
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
