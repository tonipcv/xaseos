import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const task = await prisma.task.findFirst({ where: { id: params.id, userId: session.sub } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const versions = await prisma.taskVersion.findMany({
    where: { taskId: params.id },
    orderBy: { version: 'desc' },
  });

  return NextResponse.json(versions);
}
