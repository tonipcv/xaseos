import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const datasets = await prisma.dataset.findMany({
    where: { userId: session.sub },
    include: { runs: { include: { run: { include: { responses: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(datasets);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, description, exportFormat, runIds } = await req.json();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const requestedRunIds = Array.isArray(runIds)
      ? Array.from(new Set(runIds.filter((runId: unknown): runId is string => typeof runId === 'string')))
      : [];
    const validRuns = requestedRunIds.length
      ? await prisma.run.findMany({
          where: { id: { in: requestedRunIds }, userId: session.sub, status: 'completed' },
          select: { id: true },
        })
      : [];

    if (validRuns.length !== requestedRunIds.length) {
      return NextResponse.json({ error: 'Some runs are invalid or not completed' }, { status: 400 });
    }

    const dataset = await prisma.dataset.create({
      data: {
        id: createId(),
        userId: session.sub,
        name,
        description: description || null,
        exportFormat: exportFormat || 'jsonl',
        runs: validRuns.length
          ? { create: validRuns.map(({ id }) => ({ runId: id })) }
          : undefined,
      },
      include: { runs: true },
    });

    return NextResponse.json(dataset, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create dataset' }, { status: 500 });
  }
}
