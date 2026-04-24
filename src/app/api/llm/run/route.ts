import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { callLLM, estimateCost } from '@/lib/llm';
import { DEFAULT_MODELS } from '@/types';
import { createId } from '@/lib/utils';
import { decryptSecret } from '@/lib/secrets';
import { llmRateLimit, createRateLimitHeaders } from '@/lib/middleware/rate-limit';
import { parseBody, LLMRunSchema } from '@/lib/validation';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/llm/run');

export async function POST(req: NextRequest) {
  // Rate limiting check
  const rateLimitResult = await llmRateLimit(req);
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!;
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: body, error: parseError } = await parseBody(req, LLMRunSchema);
  if (parseError) return parseError;

  try {
    const { taskId } = body;

    const task = await prisma.task.findFirst({ where: { id: taskId, userId: session.sub } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const apiKeys = await prisma.userApiKey.findMany({ where: { userId: session.sub } });
    let keyMap: Record<string, string>;
    try {
      keyMap = Object.fromEntries(apiKeys.map(k => [k.provider, decryptSecret(k.keyValue)]));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read API key';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const taskModels = DEFAULT_MODELS.filter(m => task.modelIds.includes(m.id));
    if (taskModels.length === 0) {
      return NextResponse.json({ error: 'No models configured for this task' }, { status: 400 });
    }

    const runId = createId();
    await prisma.run.create({
      data: {
        id: runId,
        userId: session.sub,
        taskId: task.id,
        taskName: task.name,
        status: 'running',
      },
    });

    const responses = await Promise.all(
      taskModels.map(async (model) => {
        const apiKey = keyMap[model.provider];

        if (!apiKey && model.provider !== 'ollama') {
          return {
            id: createId(),
            runId,
            modelId: model.id,
            modelName: model.name,
            provider: model.provider,
            content: null,
            latencyMs: 0,
            tokensUsed: null,
            inputTokens: null,
            outputTokens: null,
            cost: null,
            error: `No API key configured for ${model.provider}`,
          };
        }

        const result = await callLLM({
          model,
          systemPrompt: task.systemPrompt ?? undefined,
          userPrompt: task.userPrompt,
          apiKey: apiKey ?? '',
        });

        const cost = estimateCost(model.id, result.inputTokens ?? 0, result.outputTokens ?? 0);
        return {
          id: createId(),
          runId,
          modelId: result.modelId,
          modelName: result.modelName,
          provider: result.provider,
          content: result.content || null,
          latencyMs: result.latencyMs,
          tokensUsed: result.tokensUsed || null,
          inputTokens: result.inputTokens || null,
          outputTokens: result.outputTokens || null,
          cost: cost || null,
          error: result.error || null,
        };
      })
    );

    await Promise.all(
      responses.map(response => prisma.modelResponse.create({ data: response }))
    );

    const totalCost = responses.reduce((acc, response) => acc + (response.cost ?? 0), 0);
    const hasErrors = responses.some(response => !!response.error);

    await prisma.run.update({
      where: { id: runId },
      data: {
        status: hasErrors ? 'failed' : 'completed',
        completedAt: new Date(),
        costEstimate: totalCost,
      },
    });

    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: { responses: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const validResponses = run.responses.filter(response => !response.error);
    const response = NextResponse.json({
      success: true,
      runId: run.id,
      responses: validResponses,
      costEstimate: totalCost,
    });

    // Add rate limit headers
    if (rateLimitResult.info) {
      const headers = createRateLimitHeaders(rateLimitResult.info);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }

    return response;
  } catch (err) {
    log.error({ err }, 'llm run failed');
    return NextResponse.json({ error: 'Run failed' }, { status: 500 });
  }
}
