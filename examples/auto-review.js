/**
 * auto-review.js — Use LLM-as-a-Judge to auto-review a completed run
 *
 * Fetches all unreviewed responses from the queue and triggers
 * the judge endpoint for each one automatically.
 *
 * Usage:
 *   XASEOS_URL=http://localhost:3002 \
 *   XASEOS_EMAIL=admin@xase.ai \
 *   XASEOS_PASSWORD=admin123 \
 *   node examples/auto-review.js
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

async function getQueue(token) {
  const res = await fetch(`${BASE_URL}/api/queue`, {
    headers: { Cookie: `auth_token=${token}` },
  });
  if (!res.ok) throw new Error(`Queue fetch failed: ${res.status}`);
  return res.json();
}

async function judgeResponse(token, { runId, modelResponseId, content, taskPrompt }) {
  const res = await fetch(`${BASE_URL}/api/llm/judge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${token}`,
    },
    body: JSON.stringify({ runId, modelResponseId, content, taskPrompt }),
  });
  if (!res.ok) throw new Error(`Judge failed: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('🔑 Logging in...');
  const token = await login();
  console.log('✅ Authenticated\n');

  console.log('📋 Fetching annotation queue...');
  const queue = await getQueue(token);

  if (!queue.responses || queue.responses.length === 0) {
    console.log('✅ Queue is empty — nothing to review');
    return;
  }

  console.log(`Found ${queue.responses.length} pending responses\n`);

  let judged = 0;
  let failed = 0;

  for (const item of queue.responses) {
    try {
      process.stdout.write(`  Judging [${item.modelId}] on run ${item.runId}... `);
      const result = await judgeResponse(token, {
        runId: item.runId,
        modelResponseId: item.id,
        content: item.content ?? '',
        taskPrompt: item.taskPrompt ?? '',
      });
      console.log(`✅ score=${result.score} label=${result.label}`);
      judged++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone — judged: ${judged}, failed: ${failed}`);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
