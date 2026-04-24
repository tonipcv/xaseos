# Xase OS — Examples & Cookbooks

Practical examples of how to use the Xase OS API programmatically.

---

## Available Examples

| Example | Description |
|---------|-------------|
| [`bulk-run.js`](./bulk-run.js) | Run a list of prompts across all models and collect results |
| [`export-dataset.js`](./export-dataset.js) | Export a dataset to JSONL and upload to HuggingFace Hub |
| [`auto-review.js`](./auto-review.js) | Use LLM-as-a-Judge to auto-review a completed run |
| [`stream-demo.js`](./stream-demo.js) | Stream a response from GPT-4o via the SSE endpoint |

---

## Prerequisites

```bash
# Set your Xase OS base URL and credentials
export XASEOS_URL="http://localhost:3002"
export XASEOS_EMAIL="admin@xase.ai"
export XASEOS_PASSWORD="admin123"
```

Each example authenticates via the `/api/auth/login` endpoint and stores the session cookie.
