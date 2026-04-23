import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';

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

  try {
    const { name, description, systemPrompt, userPrompt, modelIds } = await req.json();
    if (!name || !userPrompt) return NextResponse.json({ error: 'name and userPrompt required' }, { status: 400 });

    const task = await prisma.task.create({
      data: {
        id: createId(),
        userId: session.sub,
        name,
        description: description || null,
        systemPrompt: systemPrompt || null,
        userPrompt,
        modelIds: modelIds || [],
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
