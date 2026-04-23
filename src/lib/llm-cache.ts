import { prisma } from './db';
import { createId } from './utils';

interface CacheKey {
  modelId: string;
  systemPrompt: string | undefined;
  userPrompt: string;
}

function hashCacheKey({ modelId, systemPrompt, userPrompt }: CacheKey): string {
  const normalized = JSON.stringify({
    modelId,
    systemPrompt: systemPrompt?.trim() ?? '',
    userPrompt: userPrompt.trim(),
  });
  // Simple hash for deterministic lookup
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${modelId}_${Math.abs(hash).toString(36)}_${normalized.length}`;
}

interface CachedResponse {
  content: string;
  tokensUsed: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export async function getCachedResponse(key: CacheKey): Promise<CachedResponse | null> {
  const hash = hashCacheKey(key);
  const cached = await prisma.responseCache.findUnique({
    where: { hash },
  });
  if (!cached) return null;
  return {
    content: cached.response,
    tokensUsed: cached.tokensUsed,
    inputTokens: null,
    outputTokens: null,
  };
}

export async function saveCachedResponse(
  key: CacheKey,
  response: string,
  tokensUsed: number | null
): Promise<void> {
  const hash = hashCacheKey(key);
  await prisma.responseCache.upsert({
    where: { hash },
    create: {
      id: createId(),
      hash,
      modelId: key.modelId,
      provider: '', // Not needed for lookup
      response,
      tokensUsed,
    },
    update: {
      response,
      tokensUsed,
      createdAt: new Date(), // Refresh timestamp
    },
  });
}

export function shouldCache(modelId: string): boolean {
  // Don't cache Ollama (local, fast, no cost)
  // Cache everything else (paid APIs)
  return !modelId.includes('ollama') && !modelId.startsWith('llama') && !modelId.startsWith('mixtral-');
}
