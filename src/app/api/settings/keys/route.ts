import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';
import { DEFAULT_MODELS } from '@/types';
import { isLegacyEncryptedSecret } from '@/lib/secrets';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/settings/keys');

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await prisma.userApiKey.findMany({
    where: { userId: session.sub },
    select: { id: true, provider: true, createdAt: true, keyValue: true },
  });

  const masked = keys.map(({ keyValue, ...k }) => ({
    ...k,
    hasKey: true,
    needsRekey: isLegacyEncryptedSecret(keyValue),
  }));
  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { provider, keyValue } = await req.json();
    if (!provider || !keyValue) return NextResponse.json({ error: 'provider and keyValue required' }, { status: 400 });
    const storedKey = keyValue.trim();

    const existing = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId: session.sub, provider } },
    });

    if (existing) {
      const updated = await prisma.userApiKey.update({
        where: { id: existing.id },
        data: { keyValue: storedKey },
        select: { id: true, provider: true, createdAt: true },
      });
      return NextResponse.json({ ...updated, hasKey: true });
    }

    const created = await prisma.userApiKey.create({
      data: { id: createId(), userId: session.sub, provider, keyValue: storedKey },
      select: { id: true, provider: true, createdAt: true },
    });

    return NextResponse.json({ ...created, hasKey: true }, { status: 201 });
  } catch (err) {
    log.error({ err }, 'failed to save key');
    return NextResponse.json({ error: 'Failed to save key' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { provider } = await req.json();
  if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 });

  await prisma.userApiKey.deleteMany({ where: { userId: session.sub, provider } });
  await prisma.$transaction(
    DEFAULT_MODELS.filter(model => model.provider === provider).map(model =>
      prisma.userModelPref.upsert({
        where: { userId_modelId: { userId: session.sub, modelId: model.id } },
        create: {
          id: createId(),
          userId: session.sub,
          modelId: model.id,
          enabled: false,
        },
        update: { enabled: false },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
