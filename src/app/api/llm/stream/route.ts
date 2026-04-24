import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { DEFAULT_MODELS } from '@/types';
import { prisma } from '@/lib/db';
import { decryptSecret } from '@/lib/secrets';
import { parseBody, LLMStreamSchema } from '@/lib/validation';
import { createRouteLogger } from '@/lib/logger';
import { llmRateLimit } from '@/lib/middleware/rate-limit';

const log = createRouteLogger('/api/llm/stream');

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rateLimitResult = await llmRateLimit(req);
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!;
  }

  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { data, error } = await parseBody(req, LLMStreamSchema);
  if (error) return error;

  const { modelId, provider, systemPrompt, userPrompt } = data;

  const model = DEFAULT_MODELS.find(m => m.id === modelId && m.provider === provider);
  if (!model) {
    return new Response(JSON.stringify({ error: 'Model not found' }), { status: 404 });
  }

  const apiKeys = await prisma.userApiKey.findMany({ where: { userId: session.sub } });
  let apiKey: string | undefined;
  try {
    const keyMap = Object.fromEntries(apiKeys.map(k => [k.provider, decryptSecret(k.keyValue)]));
    apiKey = keyMap[provider];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read API key';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  if (!apiKey && provider !== 'ollama') {
    return new Response(
      JSON.stringify({ error: `No API key configured for ${provider}` }),
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  function sse(event: string, payload: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const startTime = Date.now();

        if (provider === 'openai' || provider === 'groq' || provider === 'grok') {
          const baseUrl =
            provider === 'groq'
              ? 'https://api.groq.com/openai/v1/chat/completions'
              : provider === 'grok'
              ? 'https://api.x.ai/v1/chat/completions'
              : 'https://api.openai.com/v1/chat/completions';

          const messages = [] as Array<{ role: string; content: string }>;
          if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
          messages.push({ role: 'user', content: userPrompt });

          const res = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: modelId, messages, stream: true }),
          });

          if (!res.ok || !res.body) {
            controller.enqueue(sse('error', { error: `Provider error: ${res.status}` }));
            controller.close();
            return;
          }

          const reader = res.body.getReader();
          const textDecoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = textDecoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
              const rawData = line.replace('data: ', '').trim();
              if (rawData === '[DONE]') break;

              try {
                const parsed = JSON.parse(rawData);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  controller.enqueue(sse('delta', { content: delta }));
                }
              } catch {
                // skip malformed SSE lines
              }
            }
          }

          controller.enqueue(
            sse('done', {
              content: fullContent,
              latencyMs: Date.now() - startTime,
              modelId,
              provider,
            })
          );
        } else if (provider === 'anthropic') {
          const messages = [{ role: 'user', content: userPrompt }];
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey!,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelId,
              max_tokens: 4096,
              system: systemPrompt,
              messages,
              stream: true,
            }),
          });

          if (!res.ok || !res.body) {
            controller.enqueue(sse('error', { error: `Anthropic error: ${res.status}` }));
            controller.close();
            return;
          }

          const reader = res.body.getReader();
          const textDecoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = textDecoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
              const rawData = line.replace('data: ', '').trim();
              try {
                const parsed = JSON.parse(rawData);
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                  const delta = parsed.delta.text;
                  fullContent += delta;
                  controller.enqueue(sse('delta', { content: delta }));
                }
              } catch {
                // skip malformed lines
              }
            }
          }

          controller.enqueue(
            sse('done', {
              content: fullContent,
              latencyMs: Date.now() - startTime,
              modelId,
              provider,
            })
          );
        } else if (provider === 'ollama') {
          const baseUrl = apiKey || 'http://localhost:11434';
          const messages = [] as Array<{ role: string; content: string }>;
          if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
          messages.push({ role: 'user', content: userPrompt });

          const res = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId, messages, stream: true }),
          });

          if (!res.ok || !res.body) {
            controller.enqueue(sse('error', { error: 'Ollama error' }));
            controller.close();
            return;
          }

          const reader = res.body.getReader();
          const textDecoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = textDecoder.decode(value, { stream: true });
            for (const line of chunk.split('\n').filter(Boolean)) {
              try {
                const parsed = JSON.parse(line);
                const delta = parsed.message?.content;
                if (delta) {
                  fullContent += delta;
                  controller.enqueue(sse('delta', { content: delta }));
                }
              } catch {
                // skip
              }
            }
          }

          controller.enqueue(
            sse('done', { content: fullContent, latencyMs: Date.now() - startTime, modelId, provider })
          );
        } else {
          controller.enqueue(sse('error', { error: `Streaming not supported for provider: ${provider}` }));
        }
      } catch (err) {
        log.error({ err }, 'stream error');
        controller.enqueue(sse('error', { error: 'Stream failed' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
