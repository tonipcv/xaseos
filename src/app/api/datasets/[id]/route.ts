import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.dataset.findFirst({ where: { id: params.id, userId: session.sub } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.dataset.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
