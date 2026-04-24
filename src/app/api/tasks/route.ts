import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';
import { parseBody, TaskCreateSchema } from '@/lib/validation';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/tasks');

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await prisma.task.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, TaskCreateSchema);
  if (error) return error;

  try {
    const task = await prisma.task.create({
      data: {
        id: createId(),
        userId: session.sub,
        name: data.name,
        description: data.description ?? null,
        systemPrompt: data.systemPrompt ?? null,
        userPrompt: data.userPrompt,
        modelIds: data.modelIds,
      },
    });

    log.info({ taskId: task.id, userId: session.sub }, 'task created');
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    log.error({ err }, 'failed to create task');
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
