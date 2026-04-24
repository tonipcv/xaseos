import { ModelResponse, LLMModel } from '@/types';
import { getCachedResponse, saveCachedResponse, shouldCache } from './llm-cache';

interface LLMCallParams {
  model: LLMModel;
  systemPrompt?: string;
  userPrompt: string;
  apiKey: string;
}

export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'grok-beta': { input: 5, output: 15 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'mixtral-8x7b-32768': { input: 0.27, output: 0.27 },
  // Qwen (Alibaba Cloud) - pricing per 1K tokens in CNY, converted to USD
  'qwen-max': { input: 5, output: 10 }, // ~$0.0071 / 1K input, ~$0.014 / 1K output
  'qwen-plus': { input: 0.8, output: 2 }, // ~$0.00114 / 1K input, ~$0.0029 / 1K output
  'qwen-turbo': { input: 0.3, output: 0.6 }, // ~$0.00043 / 1K input, ~$0.00086 / 1K output
  // DeepSeek - pricing in USD per 1M tokens
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.14, output: 2.19 },
  // Kimi (Moonshot AI) - pricing in CNY, converted to USD
  'kimi-k2-0711-preview': { input: 10, output: 50 }, // ~$1.39 / 1M input, ~$6.94 / 1M output
  'kimi-k1.5-32b-vision-preview': { input: 8, output: 32 }, // ~$1.11 / 1M input, ~$4.44 / 1M output
};

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[modelId];
  if (!costs) return 0;
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

export async function callLLM({ model, systemPrompt, userPrompt, apiKey }: LLMCallParams): Promise<ModelResponse> {
  const startTime = Date.now();

  // Check cache first (only for paid APIs, not Ollama)
  if (shouldCache(model.id)) {
    const cached = await getCachedResponse({ modelId: model.id, systemPrompt, userPrompt });
    if (cached) {
      return {
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        content: cached.content,
        latencyMs: 0, // Cached responses are instant
        tokensUsed: cached.tokensUsed ?? undefined,
        inputTokens: cached.inputTokens ?? undefined,
        outputTokens: cached.outputTokens ?? undefined,
        cost: 0, // No cost for cached responses
        cached: true,
      };
    }
  }

  try {
    switch (model.provider) {
      case 'openai':
        const result = await callOpenAI(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, result);
        return result;
      case 'anthropic':
        const resultAnthropic = await callAnthropic(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, resultAnthropic);
        return resultAnthropic;
      case 'google':
        const resultGoogle = await callGoogle(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, resultGoogle);
        return resultGoogle;
      case 'grok':
        const resultGrok = await callGrok(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, resultGrok);
        return resultGrok;
      case 'groq':
        const resultGroq = await callGroq(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, resultGroq);
        return resultGroq;
      case 'ollama':
        return await callOllama(model, systemPrompt, userPrompt, apiKey, startTime);
      case 'qwen':
        const resultQwen = await callQwen(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, resultQwen);
        return resultQwen;
      case 'deepseek':
        const resultDeepSeek = await callDeepSeek(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, resultDeepSeek);
        return resultDeepSeek;
      case 'kimi':
        const resultKimi = await callKimi(model, systemPrompt, userPrompt, apiKey, startTime);
        await maybeCacheResult(model.id, systemPrompt, userPrompt, resultKimi);
        return resultKimi;
      default:
        throw new Error(`Provider ${model.provider} not implemented`);
    }
  } catch (error) {
    return {
      modelId: model.id,
      modelName: model.name,
      provider: model.provider,
      content: '',
      latencyMs: Date.now() - startTime,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function maybeCacheResult(
  modelId: string,
  systemPrompt: string | undefined,
  userPrompt: string,
  result: ModelResponse
): Promise<void> {
  if (!result.error && shouldCache(modelId) && result.content) {
    await saveCachedResponse(
      { modelId, systemPrompt, userPrompt },
      result.content,
      result.tokensUsed ?? null
    );
  }
}

async function callOpenAI(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const messages = [] as Array<{ role: string; content: string }>;
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, messages }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.choices[0].message.content,
    latencyMs: Date.now() - startTime,
    tokensUsed: data.usage?.total_tokens,
    inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}

async function callAnthropic(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
  const data = await res.json();
  const input = data.usage?.input_tokens ?? 0;
  const output = data.usage?.output_tokens ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.content[0].text,
    latencyMs: Date.now() - startTime,
    tokensUsed: input + output, inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}

async function callGoogle(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    }),
  });
  if (!res.ok) throw new Error(`Google error: ${await res.text()}`);
  const data = await res.json();
  const total = data.usageMetadata?.totalTokenCount ?? 0;
  const input = data.usageMetadata?.promptTokenCount ?? 0;
  const output = data.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.candidates[0].content.parts[0].text,
    latencyMs: Date.now() - startTime,
    tokensUsed: total, inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}

async function callGrok(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const messages = [] as Array<{ role: string; content: string }>;
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, messages }),
  });
  if (!res.ok) throw new Error(`Grok error: ${await res.text()}`);
  const data = await res.json();
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.choices[0].message.content,
    latencyMs: Date.now() - startTime,
    tokensUsed: data.usage?.total_tokens, inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}

async function callGroq(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const messages = [] as Array<{ role: string; content: string }>;
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, messages }),
  });
  if (!res.ok) throw new Error(`Groq error: ${await res.text()}`);
  const data = await res.json();
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.choices[0].message.content,
    latencyMs: Date.now() - startTime,
    tokensUsed: data.usage?.total_tokens, inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}

async function callOllama(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const baseUrl = apiKey || 'http://localhost:11434';
  const messages = [] as Array<{ role: string; content: string }>;
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);
  const data = await res.json();
  const input = data.prompt_eval_count ?? 0;
  const output = data.eval_count ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: 'ollama',
    content: data.message?.content ?? '',
    latencyMs: Date.now() - startTime,
    tokensUsed: input + output, inputTokens: input, outputTokens: output,
    cost: 0,
  };
}

// Qwen (Alibaba Cloud) - OpenAI compatible API
async function callQwen(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const messages = [] as Array<{ role: string; content: string }>;
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, messages }),
  });
  if (!res.ok) throw new Error(`Qwen error: ${await res.text()}`);
  const data = await res.json();
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.choices[0].message.content,
    latencyMs: Date.now() - startTime,
    tokensUsed: data.usage?.total_tokens, inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}

// DeepSeek - OpenAI compatible API
async function callDeepSeek(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const messages = [] as Array<{ role: string; content: string }>;
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, messages }),
  });
  if (!res.ok) throw new Error(`DeepSeek error: ${await res.text()}`);
  const data = await res.json();
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.choices[0].message.content,
    latencyMs: Date.now() - startTime,
    tokensUsed: data.usage?.total_tokens, inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}

// Kimi (Moonshot AI) - OpenAI compatible API
async function callKimi(model: LLMModel, systemPrompt: string | undefined, userPrompt: string, apiKey: string, startTime: number): Promise<ModelResponse> {
  const messages = [] as Array<{ role: string; content: string }>;
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, messages }),
  });
  if (!res.ok) throw new Error(`Kimi error: ${await res.text()}`);
  const data = await res.json();
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  return {
    modelId: model.id, modelName: model.name, provider: model.provider,
    content: data.choices[0].message.content,
    latencyMs: Date.now() - startTime,
    tokensUsed: data.usage?.total_tokens, inputTokens: input, outputTokens: output,
    cost: estimateCost(model.id, input, output),
  };
}
