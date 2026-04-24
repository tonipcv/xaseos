import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [runs, reviews, allReviewsForRuns, tasks, datasets] = await Promise.all([
    prisma.run.findMany({
      where: { userId: session.sub },
      include: { responses: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expertReview.findMany({
      where: { reviewerId: session.sub },
      include: { response: true },
    }),
    prisma.expertReview.findMany({
      where: { run: { userId: session.sub } },
      select: { modelResponseId: true, reviewerId: true, score: true, label: true },
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

  // Inter-rater agreement: pairwise % agreement on label for responses with ≥2 reviewers
  const byResponse: Record<string, { reviewerId: string; label: string }[]> = {};
  for (const r of allReviewsForRuns) {
    if (!byResponse[r.modelResponseId]) byResponse[r.modelResponseId] = [];
    byResponse[r.modelResponseId].push({ reviewerId: r.reviewerId, label: r.label });
  }
  let agreedPairs = 0, totalPairs = 0;
  for (const reviewers of Object.values(byResponse)) {
    if (reviewers.length < 2) continue;
    for (let i = 0; i < reviewers.length; i++) {
      for (let j = i + 1; j < reviewers.length; j++) {
        totalPairs++;
        if (reviewers[i].label === reviewers[j].label) agreedPairs++;
      }
    }
  }
  const interRaterAgreement = totalPairs > 0 ? parseFloat(((agreedPairs / totalPairs) * 100).toFixed(1)) : null;
  const automatedReviews = allReviewsForRuns.filter(r => r.label === 'automated' || r.reviewerId === session.sub).length;

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
    interRaterAgreement,
    totalPairs,
  });
}
