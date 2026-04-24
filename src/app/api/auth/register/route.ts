import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken, createAuthCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { createId } from '@/lib/utils';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/auth/register');

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const isFirst = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: {
        id: createId(),
        email,
        name: name || email.split('@')[0],
        password: hash,
        role: isFirst ? 'admin' : 'reviewer',
      },
    });

    const token = await signToken({ sub: user.id, email: user.email, name: user.name ?? undefined, role: user.role });
    const cookie = createAuthCookie(token);

    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    res.cookies.set(cookie);
    return res;
  } catch (err) {
    log.error({ err }, 'registration failed');
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
