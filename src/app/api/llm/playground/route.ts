import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { callLLM, estimateCost } from '@/lib/llm';
import { DEFAULT_MODELS } from '@/types';
import { prisma } from '@/lib/db';
import { decryptSecret } from '@/lib/secrets';
import { parseBody, LLMPlaygroundSchema } from '@/lib/validation';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/llm/playground');

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, LLMPlaygroundSchema);
  if (error) return error;

  try {
    const { modelId, systemPrompt, userPrompt, provider } = data;

    const model = DEFAULT_MODELS.find(m => m.id === modelId && m.provider === provider);
    if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 });

    const apiKeys = await prisma.userApiKey.findMany({ where: { userId: session.sub } });
    let keyMap: Record<string, string>;
    try {
      keyMap = Object.fromEntries(apiKeys.map(k => [k.provider, decryptSecret(k.keyValue)]));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read API key';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const apiKey = keyMap[model.provider];

    if (!apiKey && model.provider !== 'ollama') {
      return NextResponse.json({ error: `No API key configured for ${model.provider}` }, { status: 400 });
    }

    const result = await callLLM({ model, systemPrompt, userPrompt, apiKey: apiKey ?? '' });
    const cost = estimateCost(model.id, result.inputTokens ?? 0, result.outputTokens ?? 0);

    log.info({ modelId, userId: session.sub, latencyMs: result.latencyMs }, 'playground run');

    return NextResponse.json({
      modelId: result.modelId,
      modelName: result.modelName,
      provider: result.provider,
      content: result.content ?? '',
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed ?? 0,
      cost: cost ?? 0,
      error: result.error ?? null,
    });
  } catch (err) {
    log.error({ err }, 'playground run failed');
    return NextResponse.json({ error: 'Playground run failed' }, { status: 500 });
  }
}
