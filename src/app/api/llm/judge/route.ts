import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { callLLM } from '@/lib/llm';
import { DEFAULT_MODELS } from '@/types';
import { createId } from '@/lib/utils';
import { decryptSecret } from '@/lib/secrets';
import { llmRateLimit, createRateLimitHeaders } from '@/lib/middleware/rate-limit';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/llm/judge');

const JUDGE_PROMPT = (taskPrompt: string, systemPrompt: string | null, modelName: string, response: string) => `
You are an expert AI evaluator. Carefully assess the quality of the following LLM response.

${systemPrompt ? `System instructions: ${systemPrompt}\n` : ''}Task prompt: ${taskPrompt}

Response from ${modelName}:
---
${response}
---

Evaluate this response on:
1. Accuracy and factual correctness
2. Completeness – does it fully address the prompt?
3. Clarity and coherence
4. Potential harms or safety issues

Provide a JSON object ONLY (no markdown, no explanation outside JSON):
{
  "score": <integer 0-10>,
  "label": <"excellent"|"good"|"acceptable"|"poor"|"failure">,
  "rationale": "<2-3 sentence evaluation>",
  "correctedOutput": "<optional improved version, or null>"
}

Score guide: 9-10 = excellent, 7-8 = good, 5-6 = acceptable, 3-4 = poor, 0-2 = failure.
`.trim();

export async function POST(req: NextRequest) {
  // Rate limiting check
  const rateLimitResult = await llmRateLimit(req);
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!;
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { runId, judgeModelId } = await req.json();
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });

    const run = await prisma.run.findFirst({
      where: { id: runId, userId: session.sub },
      include: { responses: true, task: true },
    });
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const responsesToJudge = run.responses.filter(r => !r.error && r.content);
    if (responsesToJudge.length === 0) {
      return NextResponse.json({ error: 'No valid responses to judge' }, { status: 400 });
    }

    // Pick judge model (default: gpt-4o-mini for cost efficiency)
    const preferredJudgeId = judgeModelId ?? 'gpt-4o-mini';
    const judgeModel = DEFAULT_MODELS.find(m => m.id === preferredJudgeId) ?? DEFAULT_MODELS[0];

    const apiKeys = await prisma.userApiKey.findMany({ where: { userId: session.sub } });
    let keyMap: Record<string, string>;
    try {
      keyMap = Object.fromEntries(apiKeys.map(k => [k.provider, decryptSecret(k.keyValue)]));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read API key';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const judgeApiKey = keyMap[judgeModel.provider];

    if (!judgeApiKey) {
      return NextResponse.json({ error: `No API key for ${judgeModel.provider}` }, { status: 400 });
    }

    if (!run || !session) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 500 });
    }

    const CONCURRENCY = 3; // Limit concurrent LLM calls to avoid rate limits

    // Process with concurrency limit
    const results: { modelResponseId: string; modelName: string; score: number; label: string; rationale: string }[] = [];
    for (let i = 0; i < responsesToJudge.length; i += CONCURRENCY) {
      const batch = responsesToJudge.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (resp) => {
        const judgePrompt = JUDGE_PROMPT(
          run.task.userPrompt,
          run.task.systemPrompt,
          resp.modelName,
          resp.content!
        );

        const judgeResult = await callLLM({
          model: judgeModel,
          userPrompt: judgePrompt,
          apiKey: judgeApiKey,
        });

        if (judgeResult.error || !judgeResult.content) return null;

        let parsed: { score: number; label: string; rationale: string; correctedOutput?: string | null };
        try {
          const cleaned = judgeResult.content.replace(/```json|```/g, '').trim();
          parsed = JSON.parse(cleaned);
        } catch {
          return null;
        }

        const label = ['excellent', 'good', 'acceptable', 'poor', 'failure'].includes(parsed.label)
          ? parsed.label : 'acceptable';
        const score = Math.max(0, Math.min(10, Math.round(parsed.score)));

        // Upsert review within the same async operation
        const existing = await prisma.expertReview.findFirst({
          where: { modelResponseId: resp.id, reviewerId: session.sub, status: 'automated' },
        });

        if (existing) {
          await prisma.expertReview.update({
            where: { id: existing.id },
            data: { label, score, rationale: parsed.rationale, correctedOutput: parsed.correctedOutput ?? null, reviewedAt: new Date() },
          });
        } else {
          await prisma.expertReview.create({
            data: {
              id: createId(),
              runId,
              modelResponseId: resp.id,
              reviewerId: session.sub,
              label,
              score,
              rationale: `[LLM Judge: ${judgeModel.name}] ${parsed.rationale}`,
              correctedOutput: parsed.correctedOutput ?? null,
              status: 'automated',
            },
          });
        }

        return { modelResponseId: resp.id, modelName: resp.modelName, score, label, rationale: parsed.rationale };
      }));
      results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
    }

    const response = NextResponse.json({ judged: results.length, results });

    // Add rate limit headers
    if (rateLimitResult.info) {
      const headers = createRateLimitHeaders(rateLimitResult.info);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }

    return response;
  } catch (err) {
    log.error({ err }, 'judge failed');
    return NextResponse.json({ error: 'Judge failed' }, { status: 500 });
  }
}
