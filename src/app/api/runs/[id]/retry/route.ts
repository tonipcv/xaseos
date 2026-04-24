import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { callLLM, MODEL_COSTS } from '@/lib/llm';
import { DEFAULT_MODELS } from '@/types';
import { decryptSecret } from '@/lib/secrets';

type RetryUpdateData = {
  content: string | null;
  latencyMs: number;
  tokensUsed: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  error: string | null;
};

type RetryResult = {
  id: string;
  data: RetryUpdateData;
  cost: number;
} | null;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const run = await prisma.run.findFirst({
    where: { id: params.id, userId: session.sub },
    include: { responses: true },
  });

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const failedResponses = run.responses.filter(r => r.error);
  if (failedResponses.length === 0) {
    return NextResponse.json({ message: 'No failed responses to retry' });
  }

  await prisma.run.update({ where: { id: run.id }, data: { status: 'running' } });

  const task = await prisma.task.findFirst({ where: { id: run.taskId, userId: session.sub } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const apiKeys = await prisma.userApiKey.findMany({ where: { userId: session.sub } });
  let keyMap: Record<string, string>;
  try {
    keyMap = Object.fromEntries(apiKeys.map(k => [k.provider, decryptSecret(k.keyValue)]));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read API key';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let totalCost = run.costEstimate ?? 0;

  const retryResults: RetryResult[] = await Promise.all(
    failedResponses.map(async (failed) => {
      const model = DEFAULT_MODELS.find(m => m.id === failed.modelId);
      if (!model) return null;

      const apiKey = keyMap[model.provider];
      if (!apiKey) return null;

      const result = await callLLM({
        model,
        systemPrompt: task.systemPrompt ?? undefined,
        userPrompt: task.userPrompt,
        apiKey,
      });

      const costs = MODEL_COSTS[model.id];
      const cost = costs && result.inputTokens && result.outputTokens
        ? (result.inputTokens * costs.input + result.outputTokens * costs.output) / 1_000_000
        : 0;

      return {
        id: failed.id,
        data: {
          content: result.content || null,
          latencyMs: result.latencyMs,
          tokensUsed: result.tokensUsed || null,
          inputTokens: result.inputTokens || null,
          outputTokens: result.outputTokens || null,
          cost: cost || null,
          error: result.error || null,
        },
        cost,
      };
    })
  );

  const retriedResponses = retryResults.filter((result): result is Exclude<RetryResult, null> => result !== null);

  await Promise.all(
    retriedResponses.map(result =>
      prisma.modelResponse.update({
        where: { id: result.id },
        data: result.data,
      })
    )
  );

  totalCost += retriedResponses.reduce((acc, result) => acc + result.cost, 0);

  const stillFailed = await prisma.modelResponse.count({ where: { runId: run.id, error: { not: null } } });
  await prisma.run.update({
    where: { id: run.id },
    data: {
      status: stillFailed === 0 ? 'completed' : 'failed',
      completedAt: new Date(),
      costEstimate: totalCost,
    },
  });

  const updated = await prisma.run.findUnique({
    where: { id: run.id },
    include: { responses: { include: { reviews: true } } },
  });

  return NextResponse.json(updated);
}
