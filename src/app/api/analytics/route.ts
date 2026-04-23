import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [runs, reviews, tasks, datasets] = await Promise.all([
    prisma.run.findMany({
      where: { userId: session.sub },
      include: { responses: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expertReview.findMany({
      where: { reviewerId: session.sub },
      include: { response: true },
    }),
    prisma.task.count({ where: { userId: session.sub } }),
    prisma.dataset.count({ where: { userId: session.sub } }),
  ]);

  const completedRuns = runs.filter(r => r.status === 'completed');
  const failedRuns = runs.filter(r => r.status === 'failed');
  const billableRuns = runs.filter(r => r.status === 'completed' || r.status === 'failed');

  const totalCost = billableRuns.reduce((acc, r) => acc + (r.costEstimate ?? 0), 0);
  const totalTokens = billableRuns.flatMap(r => r.responses).reduce((acc, r) => acc + (r.tokensUsed ?? 0), 0);

  const avgLatencyByModel: Record<string, { total: number; count: number }> = {};
  const errorsByModel: Record<string, number> = {};

  for (const run of billableRuns) {
    for (const resp of run.responses) {
      if (!avgLatencyByModel[resp.modelId]) avgLatencyByModel[resp.modelId] = { total: 0, count: 0 };
      avgLatencyByModel[resp.modelId].total += resp.latencyMs;
      avgLatencyByModel[resp.modelId].count++;
      if (resp.error) errorsByModel[resp.modelId] = (errorsByModel[resp.modelId] ?? 0) + 1;
    }
  }

  const avgLatencyPerModel = Object.entries(avgLatencyByModel).map(([modelId, { total, count }]) => ({
    modelId,
    avgLatency: Math.round(total / count),
    totalResponses: count,
    errors: errorsByModel[modelId] ?? 0,
  }));

  const avgScoreByModel: Record<string, { total: number; count: number }> = {};
  const labelDist: Record<string, number> = {};

  for (const review of reviews) {
    const mid = review.response.modelId;
    if (!avgScoreByModel[mid]) avgScoreByModel[mid] = { total: 0, count: 0 };
    avgScoreByModel[mid].total += review.score;
    avgScoreByModel[mid].count++;
    labelDist[review.label] = (labelDist[review.label] ?? 0) + 1;
  }

  const scoresByModel = Object.entries(avgScoreByModel).map(([modelId, { total, count }]) => ({
    modelId,
    avgScore: parseFloat((total / count).toFixed(2)),
    reviewCount: count,
  }));

  const costOverTime = billableRuns
    .filter(r => r.costEstimate && r.costEstimate > 0)
    .map(r => ({
      date: r.createdAt.toISOString().split('T')[0],
      cost: r.costEstimate,
    }));

  const runsOverTime = runs.reduce((acc: Record<string, number>, r) => {
    const day = r.createdAt.toISOString().split('T')[0];
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    summary: {
      tasks,
      totalRuns: runs.length,
      completedRuns: completedRuns.length,
      failedRuns: failedRuns.length,
      totalReviews: reviews.length,
      datasets,
      totalCost: parseFloat(totalCost.toFixed(6)),
      totalTokens,
    },
    avgLatencyPerModel,
    scoresByModel,
    labelDistribution: Object.entries(labelDist).map(([label, count]) => ({ label, count })),
    costOverTime,
    runsOverTime: Object.entries(runsOverTime).map(([date, count]) => ({ date, count })),
  });
}
