import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Use NOT EXISTS subquery to filter only unreviewed responses at the database level
  // This is more efficient than loading all and filtering in memory
  const responses = await prisma.$queryRaw`
    SELECT
      mr.id,
      mr."runId",
      mr."modelName",
      mr.provider,
      mr.content,
      mr."latencyMs",
      r."createdAt",
      r."taskName",
      t."userPrompt" as "taskPrompt"
    FROM "ModelResponse" mr
    JOIN "Run" r ON mr."runId" = r.id
    JOIN "Task" t ON r."taskId" = t.id
    WHERE r."userId" = ${session.sub}
      AND r.status = 'completed'
      AND mr.error IS NULL
      AND mr.content IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ExpertReview" er
        WHERE er."modelResponseId" = mr.id
          AND er."reviewerId" = ${session.sub}
      )
    ORDER BY r."createdAt" DESC
    LIMIT 50
  `;

  // Transform raw results to match expected interface
  const pending = (responses as any[]).map(r => ({
    id: r.id,
    runId: r.runId,
    modelName: r.modelName,
    provider: r.provider,
    content: r.content,
    latencyMs: r.latencyMs,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    taskName: r.taskName,
    taskPrompt: r.taskPrompt,
  }));

  return NextResponse.json(pending);
}
