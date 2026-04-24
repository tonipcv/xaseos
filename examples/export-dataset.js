/**
 * export-dataset.js — Export a dataset to JSONL
 *
 * Lists all datasets, exports the first one to JSONL, and
 * optionally pushes it to HuggingFace Hub if HF_REPO is set.
 *
 * Usage:
 *   XASEOS_URL=http://localhost:3002 \
 *   XASEOS_EMAIL=admin@xase.ai \
 *   XASEOS_PASSWORD=admin123 \
 *   HF_REPO=myuser/my-dataset \           # optional
 *   HF_TOKEN=hf_...  \                    # optional
 *   node examples/export-dataset.js
 */

import { writeFileSync } from 'fs';

const BASE_URL = process.env.XASEOS_URL ?? 'http://localhost:3002';
const EMAIL = process.env.XASEOS_EMAIL ?? 'admin@xase.ai';
const PASSWORD = process.env.XASEOS_PASSWORD ?? 'admin123';
const HF_REPO = process.env.HF_REPO;
const HF_TOKEN = process.env.HF_TOKEN;

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

async function listDatasets(token) {
  const res = await fetch(`${BASE_URL}/api/datasets`, {
    headers: { Cookie: `auth_token=${token}` },
  });
  if (!res.ok) throw new Error(`List datasets failed: ${res.status}`);
  return res.json();
}

async function exportDataset(token, datasetId, format = 'jsonl') {
  const res = await fetch(`${BASE_URL}/api/datasets/${datasetId}/export?format=${format}`, {
    headers: { Cookie: `auth_token=${token}` },
  });
  if (!res.ok) throw new Error(`Export failed: ${await res.text()}`);
  return res.text();
}

async function pushToHub(token, datasetId, repoId) {
  const res = await fetch(`${BASE_URL}/api/datasets/${datasetId}/push-to-hub`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${token}`,
    },
    body: JSON.stringify({ repoId, token: HF_TOKEN }),
  });
  if (!res.ok) throw new Error(`Push failed: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('🔑 Logging in...');
  const token = await login();
  console.log('✅ Authenticated\n');

  console.log('📂 Listing datasets...');
  const datasets = await listDatasets(token);

  if (!datasets.length) {
    console.log('No datasets found. Create one via the UI first.');
    return;
  }

  const dataset = datasets[0];
  console.log(`Using dataset: "${dataset.name}" (${dataset.id})\n`);

  console.log('📥 Exporting as JSONL...');
  const content = await exportDataset(token, dataset.id, 'jsonl');
  const lines = content.split('\n').filter(Boolean);
  const filename = `${dataset.name.replace(/\s+/g, '-').toLowerCase()}.jsonl`;
  writeFileSync(filename, content);
  console.log(`✅ Saved ${lines.length} rows to ./${filename}`);

  if (HF_REPO && HF_TOKEN) {
    console.log(`\n🤗 Pushing to HuggingFace Hub: ${HF_REPO}...`);
    const result = await pushToHub(token, dataset.id, HF_REPO);
    console.log('✅ Push result:', result);
  } else {
    console.log('\nSet HF_REPO and HF_TOKEN env vars to push to HuggingFace Hub.');
  }
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
