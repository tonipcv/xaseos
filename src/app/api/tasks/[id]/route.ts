import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/tasks/[id]');

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const task = await prisma.task.findFirst({ where: { id: params.id, userId: session.sub } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(task);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, description, systemPrompt, userPrompt, modelIds } = await req.json();

    // Atomic transaction: verify ownership, create snapshot, update task
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({ where: { id: params.id, userId: session.sub } });
      if (!existing) throw new Error('Not found');

      // Get next version number atomically within transaction
      const lastVersion = await tx.taskVersion.findFirst({
        where: { taskId: params.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (lastVersion?.version ?? 0) + 1;

      // Create version snapshot
      await tx.taskVersion.create({
        data: {
          id: createId(),
          taskId: params.id,
          version: nextVersion,
          name: existing.name,
          description: existing.description,
          systemPrompt: existing.systemPrompt,
          userPrompt: existing.userPrompt,
          modelIds: existing.modelIds,
        },
      });

      // Update task
      const task = await tx.task.update({
        where: { id: params.id },
        data: {
          name: name ?? existing.name,
          description: description ?? existing.description,
          systemPrompt: systemPrompt ?? existing.systemPrompt,
          userPrompt: userPrompt ?? existing.userPrompt,
          modelIds: modelIds ?? existing.modelIds,
          updatedAt: new Date(),
        },
      });

      return task;
    }, { isolationLevel: 'Serializable' }); // Serializable prevents concurrent edits creating same version

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'Not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    log.error({ err }, 'failed to update task');
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.task.findFirst({ where: { id: params.id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
