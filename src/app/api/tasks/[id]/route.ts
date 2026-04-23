import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

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

    const existing = await prisma.task.findFirst({ where: { id: params.id, userId: session.sub } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const task = await prisma.task.update({
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

    return NextResponse.json(task);
  } catch (err) {
    console.error(err);
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
