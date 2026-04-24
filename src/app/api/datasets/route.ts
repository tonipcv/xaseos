import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';
import { parseBody, DatasetCreateSchema } from '@/lib/validation';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/datasets');

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Lightweight query: only counts, not full run data
  const datasets = await prisma.dataset.findMany({
    where: { userId: session.sub },
    include: {
      _count: { select: { runs: true } },
      runs: { select: { runId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(datasets);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, DatasetCreateSchema);
  if (error) return error;

  try {
    const { name, description, exportFormat, runIds } = data;

    const requestedRunIds = Array.from(new Set(runIds));
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
        description: description ?? null,
        exportFormat,
        runs: validRuns.length
          ? { create: validRuns.map(({ id }) => ({ runId: id })) }
          : undefined,
      },
      include: { runs: true },
    });

    log.info({ datasetId: dataset.id, userId: session.sub }, 'dataset created');
    return NextResponse.json(dataset, { status: 201 });
  } catch (err) {
    log.error({ err }, 'failed to create dataset');
    return NextResponse.json({ error: 'Failed to create dataset' }, { status: 500 });
  }
}
