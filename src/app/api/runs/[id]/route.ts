import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/runs/[id]');

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const run = await prisma.run.findFirst({
    where: { id: params.id, userId: session.sub },
    include: {
      task: {
        select: { userPrompt: true, systemPrompt: true }
      },
      responses: {
        include: {
          reviews: {
            include: { reviewer: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(run);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await prisma.run.findFirst({
      where: { id: params.id, userId: session.sub },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allowed: Record<string, unknown> = {};
    if (typeof body.status === 'string') allowed.status = body.status;
    if (typeof body.costEstimate === 'number') allowed.costEstimate = body.costEstimate;
    if (body.completedAt) allowed.completedAt = new Date(body.completedAt);
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    const run = await prisma.run.update({
      where: { id: params.id },
      data: allowed,
      include: { responses: true },
    });
    return NextResponse.json(run);
  } catch (err) {
    log.error({ err }, 'failed to update run');
    return NextResponse.json({ error: 'Failed to update run' }, { status: 500 });
  }
}
