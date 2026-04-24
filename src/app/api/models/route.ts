import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { DEFAULT_MODELS } from '@/types';
import { createId } from '@/lib/utils';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/models');

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prefs = await prisma.userModelPref.findMany({ where: { userId: session.sub } });
  const prefMap = Object.fromEntries(prefs.map(p => [p.modelId, p.enabled]));

  const models = DEFAULT_MODELS.map(m => ({
    ...m,
    enabled: prefMap[m.id] !== undefined ? prefMap[m.id] : m.enabled,
  }));

  return NextResponse.json(models);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { modelId, enabled } = await req.json();
    if (!modelId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'modelId and enabled required' }, { status: 400 });
    }

    await prisma.userModelPref.upsert({
      where: { userId_modelId: { userId: session.sub, modelId } },
      create: { id: createId(), userId: session.sub, modelId, enabled },
      update: { enabled },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error({ err }, 'failed to update model');
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
  }
}
