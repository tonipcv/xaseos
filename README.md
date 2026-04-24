<div align="center">

# Xase OS

### Open-source LLM Evaluation & Fine-tuning Data Platform

[![CI](https://github.com/tonipcv/xaseos/actions/workflows/ci.yml/badge.svg)](https://github.com/tonipcv/xaseos/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**Run prompts across 6 LLM providers in parallel · Collect expert reviews · Export fine-tuning datasets**

[Quick Start](#-quick-start) · [Features](#-features) · [API Reference](#-api-routes) · [Contributing](./CONTRIBUTING.md) · [Roadmap](#-roadmap)

</div>

---

## Why Xase OS?

| Problem | How Xase OS solves it |
|---------|----------------------|
| Testing one model at a time is slow | Run OpenAI, Anthropic, Google, Grok, Groq, and Ollama **in parallel** |
| Evaluating quality by hand doesn't scale | **LLM-as-a-Judge** scores responses automatically; humans review the edge cases |
| Fine-tuning data is scattered | Everything flows from prompt → run → review → **JSONL/HuggingFace dataset** |
| API costs spiral out of control | **Deterministic response caching** — identical prompts never hit the API twice |
| No audit trail for prompt changes | **Full version history** — every task edit creates a restorable snapshot |

---

## ⚡ Quick Start

### Docker (3 commands)

```bash
git clone https://github.com/tonipcv/xaseos.git && cd xaseos
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) — login: `admin@xase.ai` / `admin123`

### Local Development

```bash
git clone https://github.com/tonipcv/xaseos.git && cd xaseos
cp .env.example .env        # fill in required vars (see .env.example)
npm install
node scripts/migrate.js     # idempotent SQL migrations
npx prisma generate
node scripts/seed.js        # creates admin@xase.ai / admin123
npm run dev                 # http://localhost:3002
```

---

## ✨ Features

### Multi-Provider LLM Execution

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-4o, GPT-4o-mini |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus |
| **Google** | Gemini 1.5 Pro, Gemini 1.5 Flash |
| **Grok (xAI)** | Grok Beta |
| **Groq** | Llama 3.3 70B, Mixtral 8x7B |
| **Ollama** | Any locally-served model |

### Evaluation

- **Side-by-Side Comparison** — latency, token count, cost per response
- **Expert Review System** — labels (`excellent / good / acceptable / poor / failure`), scores 0–10, corrected outputs
- **LLM-as-a-Judge** — automated GPT-4o-mini scoring for scale
- **Annotation Queue** — review pending responses without losing context
- **Inter-rater Agreement** — pairwise % agreement across multiple reviewers

### Data & Datasets

- **Import** — JSON / JSONL upload, rows become runs automatically
- **Export** — JSONL, CSV, JSON with one click
- **HuggingFace Hub Push** — one-click push to `datasets/<repo>`
- **Task Version History** — every edit snapshots the previous state; restore any version

### Analytics

- Latency & score charts per model (bar charts via Recharts)
- Label distribution with proportional bars
- Cumulative and per-run API cost tracking

### Task Templates (pre-built rubrics)

| Template | Use case |
|----------|----------|
| Healthcare Safety | Medical Q&A accuracy and harm avoidance |
| Legal Accuracy | General legal information quality |
| Code Review | Bug detection, security, style |
| Creative Writing | Storytelling, engagement, originality |
| Red Teaming | Safety guardrail and refusal testing |

### Platform

- **Dark Mode** — system-aware, toggleable, persisted in localStorage
- **Response Caching** — hash-based, zero duplicate API calls
- **Rate Limiting** — per-user in-memory limiter (10 LLM req/min)
- **JWT Auth** — httpOnly cookies, Argon2id password hashing

---

## 🏗 Architecture

```
┌──────────────┐     REST API      ┌─────────────────────┐
│  Next.js 14  │ ◄───────────────► │   API Routes        │
│  App Router  │                   │  /api/tasks         │
│  React 18    │                   │  /api/llm/run       │  ◄── Parallel LLM calls
│  Tailwind    │                   │  /api/reviews       │
└──────────────┘                   │  /api/datasets      │
                                   │  /api/analytics     │
                                   └──────────┬──────────┘
                                              │ Prisma ORM
                                   ┌──────────▼──────────┐
                                   │     PostgreSQL       │
                                   │  tasks · runs        │
                                   │  reviews · datasets  │
                                   │  api_keys (AES-GCM)  │
                                   └─────────────────────┘
```

---

## 🔌 API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/llm/run` | Run a task across all selected models |
| `POST` | `/api/llm/stream` | Streaming SSE response from a single model |
| `POST` | `/api/llm/judge` | LLM-as-a-Judge automated scoring |
| `POST` | `/api/llm/playground` | Single-model prompt test |
| `GET/POST` | `/api/tasks` | List / create tasks |
| `PUT/DELETE` | `/api/tasks/:id` | Update / delete task (snapshots on PUT) |
| `GET` | `/api/tasks/:id/versions` | Task version history |
| `POST` | `/api/reviews` | Create or update expert review |
| `GET` | `/api/queue` | Pending unreviewed responses |
| `GET/POST` | `/api/datasets` | List / create datasets |
| `POST` | `/api/datasets/import` | Import JSON/JSONL file |
| `GET` | `/api/datasets/:id/export` | Download dataset |
| `POST` | `/api/datasets/:id/push-to-hub` | Push to HuggingFace Hub |
| `GET` | `/api/analytics` | Full analytics payload |
| `GET` | `/api/openapi.json` | OpenAPI 3.1 specification |

---

## ⚙️ Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Min 32 chars — signs auth tokens | ✅ |
| `ENCRYPTION_KEY` | Min 32 chars — encrypts stored API keys | ✅ |
| `NEXT_PUBLIC_APP_URL` | App URL (default: `http://localhost:3002`) | No |

See [`.env.example`](./.env.example) for the full reference with generation commands.

---

## 📁 Project Structure

```
├── .github/
│   ├── workflows/         # CI/CD: lint → typecheck → test → Docker build
│   ├── ISSUE_TEMPLATE/    # Bug report & feature request templates
│   └── pull_request_template.md
├── prisma/                # Schema (client-only; Prisma migrate is forbidden)
├── scripts/
│   ├── migrate.js         # Runs migrate.sql via pg driver (idempotent)
│   ├── migrate.sql        # All DDL with IF NOT EXISTS guards
│   └── seed.js            # Creates test admin user
├── src/
│   ├── app/
│   │   ├── (auth)/        # Login / register pages
│   │   ├── (dashboard)/   # Authenticated pages (tasks, runs, analytics…)
│   │   └── api/           # REST API routes
│   ├── components/        # Shared UI components
│   ├── lib/               # auth, db, llm, cache, logger, secrets, store
│   └── types/             # Shared TypeScript interfaces
├── examples/              # Usage examples and cookbooks
└── AGENTS.md              # Guide for AI-assisted contributions
```

---

## 🗺 Roadmap

### v0.2 — In Progress
- [x] LLM-as-a-Judge automated scoring
- [x] HuggingFace Hub push
- [x] Task version history
- [x] Response caching
- [ ] **Streaming SSE** responses (in progress)
- [ ] **OpenAPI spec** at `/api/openapi.json`

### v0.3 — Planned
- [ ] BullMQ job queue for long-running batch evaluations
- [ ] Redis-based rate limiting (multi-instance safe)
- [ ] Webhook notifications (Slack, Discord)
- [ ] Team workspaces with role-based access

### v0.4 — Future
- [ ] Python SDK (`pip install xaseos`)
- [ ] Custom metric plugins
- [ ] Multi-language README (PT-BR, ES, ZH)
- [ ] Self-hosted telemetry dashboard

> Vote on features or propose new ones in [GitHub Discussions](https://github.com/tonipcv/xaseos/discussions).

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, conventions, and architecture diagrams.

Quick contribution workflow:
```bash
git checkout -b feat/my-feature develop
# make changes
npm run lint && npm run test
git commit -m "feat: describe your change"
# open PR against develop
```

---

## 📄 License

[MIT](./LICENSE) © 2024 Xase AI

