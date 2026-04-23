import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { runId, modelResponseId, label, score, rationale, correctedOutput, status } = await req.json();

    if (!runId || !modelResponseId || !label || score === undefined || !rationale) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const run = await prisma.run.findFirst({
      where: { id: runId, userId: session.sub },
    });
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const response = await prisma.modelResponse.findFirst({
      where: { id: modelResponseId, runId: run.id },
    });
    if (!response) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = await prisma.expertReview.findFirst({
      where: { runId, modelResponseId, reviewerId: session.sub },
    });

    let review;
    if (existing) {
      review = await prisma.expertReview.update({
        where: { id: existing.id },
        data: { label, score, rationale, correctedOutput: correctedOutput || null, status: status || 'done', reviewedAt: new Date() },
        include: { reviewer: { select: { id: true, name: true, email: true } } },
      });
    } else {
      review = await prisma.expertReview.create({
        data: {
          id: createId(),
          runId,
          modelResponseId,
          reviewerId: session.sub,
          label,
          score,
          rationale,
          correctedOutput: correctedOutput || null,
          status: status || 'done',
        },
        include: { reviewer: { select: { id: true, name: true, email: true } } },
      });
    }

    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }
}
