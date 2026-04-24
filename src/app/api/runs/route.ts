import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/runs');

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const summaryMode = url.searchParams.get('summary') === '1' || url.searchParams.get('summary') === 'true';
  const limitParam = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined;
  const statusFilter = url.searchParams.get('status') || undefined;
  const fields = url.searchParams.get('fields')?.split(',').filter(Boolean) ?? [];

  const where = {
    userId: session.sub,
    ...(statusFilter && { status: statusFilter }),
  };

  // Lightweight mode for dropdown selection (datasets page)
  if (fields.length > 0 && !summaryMode) {
    const select: Record<string, boolean> = {};
    for (const f of fields) select[f] = true;
    const runs = await prisma.run.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select,
    });
    return NextResponse.json(runs);
  }

  if (summaryMode) {
    const runs = await prisma.run.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        taskName: true,
        status: true,
        createdAt: true,
        costEstimate: true,
        _count: { select: { responses: true } },
      },
    });

    return NextResponse.json(runs.map(run => ({
      id: run.id,
      taskName: run.taskName,
      status: run.status,
      createdAt: run.createdAt,
      costEstimate: run.costEstimate,
      responsesCount: run._count.responses,
    })));
  }

  const runs = await prisma.run.findMany({
    where,
    include: { responses: { include: { reviews: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(runs);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { taskId, taskName } = await req.json();
    if (!taskId || !taskName) return NextResponse.json({ error: 'taskId and taskName required' }, { status: 400 });

    const task = await prisma.task.findFirst({ where: { id: taskId, userId: session.sub } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const run = await prisma.run.create({
      data: {
        id: crypto.randomUUID(),
        userId: session.sub,
        taskId,
        taskName,
        status: 'running',
      },
    });

    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    log.error({ err }, 'failed to create run');
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }
}
