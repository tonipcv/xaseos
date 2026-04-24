/**
 * stream-demo.js — Stream a response from a model via the SSE endpoint
 *
 * Usage:
 *   XASEOS_URL=http://localhost:3002 \
 *   XASEOS_EMAIL=admin@xase.ai \
 *   XASEOS_PASSWORD=admin123 \
 *   node examples/stream-demo.js
 */

const BASE_URL = process.env.XASEOS_URL ?? 'http://localhost:3002';
const EMAIL = process.env.XASEOS_EMAIL ?? 'admin@xase.ai';
const PASSWORD = process.env.XASEOS_PASSWORD ?? 'admin123';

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const setCookie = res.headers.get('set-cookie');
  const match = setCookie?.match(/auth_token=([^;]+)/);
  if (!match) throw new Error('No auth cookie returned');
  return match[1];
}

async function streamResponse(token, { modelId, provider, systemPrompt, userPrompt }) {
  const res = await fetch(`${BASE_URL}/api/llm/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${token}`,
    },
    body: JSON.stringify({ modelId, provider, systemPrompt, userPrompt }),
  });

  if (!res.ok) throw new Error(`Stream request failed: ${await res.text()}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  process.stdout.write('\n📡 Streaming: ');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: delta')) continue;
      if (line.startsWith('data: ')) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.content) process.stdout.write(payload.content);
          if (payload.latencyMs !== undefined) {
            process.stdout.write(`\n\n✅ Done in ${payload.latencyMs}ms\n`);
          }
          if (payload.error) {
            process.stdout.write(`\n❌ Error: ${payload.error}\n`);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}

async function main() {
  console.log('🔑 Logging in...');
  const token = await login();
  console.log('✅ Authenticated');

  await streamResponse(token, {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    systemPrompt: 'You are a concise technical writer.',
    userPrompt: 'Explain what a transformer neural network is in 5 sentences.',
  });
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
