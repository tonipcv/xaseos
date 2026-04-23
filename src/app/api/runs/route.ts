import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const summaryMode = url.searchParams.get('summary') === '1' || url.searchParams.get('summary') === 'true';
  const limitParam = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : undefined;

  if (summaryMode) {
    const runs = await prisma.run.findMany({
      where: { userId: session.sub },
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
    where: { userId: session.sub },
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
    console.error(err);
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }
}
