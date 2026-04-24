/**
 * bulk-run.js — Run a list of prompts across all models and collect results
 *
 * Usage:
 *   XASEOS_URL=http://localhost:3002 \
 *   XASEOS_EMAIL=admin@xase.ai \
 *   XASEOS_PASSWORD=admin123 \
 *   node examples/bulk-run.js
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

async function createTask(token, { name, userPrompt, systemPrompt, modelIds }) {
  const res = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${token}`,
    },
    body: JSON.stringify({ name, userPrompt, systemPrompt, modelIds }),
  });
  if (!res.ok) throw new Error(`Create task failed: ${await res.text()}`);
  return res.json();
}

async function runTask(token, taskId) {
  const res = await fetch(`${BASE_URL}/api/llm/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${token}`,
    },
    body: JSON.stringify({ taskId }),
  });
  if (!res.ok) throw new Error(`Run failed: ${await res.text()}`);
  return res.json();
}

const PROMPTS = [
  { name: 'Explain transformers', userPrompt: 'Explain transformer architecture in 3 sentences.' },
  { name: 'Python fizzbuzz', userPrompt: 'Write a Python FizzBuzz for numbers 1-20.' },
  { name: 'Haiku about AI', userPrompt: 'Write a haiku about artificial intelligence.' },
];

const MODEL_IDS = ['gpt-4o-mini', 'claude-3-5-sonnet-20241022'];

async function main() {
  console.log('🔑 Logging in...');
  const token = await login();
  console.log('✅ Authenticated\n');

  for (const prompt of PROMPTS) {
    console.log(`📝 Creating task: "${prompt.name}"`);
    const task = await createTask(token, { ...prompt, modelIds: MODEL_IDS });
    console.log(`   Task ID: ${task.id}`);

    console.log(`🚀 Running task across ${MODEL_IDS.length} models...`);
    const result = await runTask(token, task.id);

    console.log(`   Run ID: ${result.runId}`);
    console.log(`   Responses: ${result.responses.length}`);
    for (const r of result.responses) {
      const preview = (r.content ?? '').slice(0, 80).replace(/\n/g, ' ');
      console.log(`   [${r.modelId}] ${preview}...`);
    }
    console.log(`   Total cost: $${result.costEstimate?.toFixed(6) ?? '0'}\n`);
  }

  console.log('✅ All prompts completed');
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
