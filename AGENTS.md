# AGENTS.md — Guide for AI-Assisted Contributions

This file is intended for AI coding agents (Windsurf Cascade, GitHub Copilot, Cursor, etc.) contributing to Xase OS. Read it fully before making any change.

---

## Project Identity

**Xase OS** is an open-source LLM evaluation and fine-tuning data platform built with:
- Next.js 14 App Router + TypeScript
- PostgreSQL via Prisma ORM (client-only — never `prisma migrate`)
- Tailwind CSS with a custom palette (`sand-*`, `warmgray-*`, `slateblue-*`)
- Pino for structured logging
- Zod for API input validation
- Vitest for unit tests

---

## Mandatory Rules (Non-negotiable)

### 1. Never use `prisma migrate`
All database schema changes MUST follow this sequence:
1. Write idempotent SQL in `scripts/migrate.sql` (`IF NOT EXISTS`, etc.)
2. Execute via `node scripts/migrate.js`
3. Update `prisma/schema.prisma`
4. Run `npx prisma generate`

### 2. Never commit secrets
- Never add real credentials, API keys, or passwords to any file
- `.env` is gitignored; `.env.example` contains only placeholder values

### 3. No `console.*` — use the logger
```typescript
import { createRouteLogger } from '@/lib/logger';
const log = createRouteLogger('/api/your-route');
log.info({ userId }, 'action performed');
log.error({ err }, 'something failed');
```

### 4. Every API route needs Zod validation
```typescript
import { parseBody, YourSchema } from '@/lib/validation';
const { data, error } = await parseBody(req, YourSchema);
if (error) return error;
```

### 5. No destructive file operations
- Never delete files without explicit instruction
- Never rename files unless architecturally required
- Never create duplicates (`*_v2.ts`, `copy.ts`, etc.)

---

## Project Structure (Authoritative)

```
src/
├── app/
│   ├── (auth)/              # Login, register pages
│   ├── (dashboard)/         # All authenticated UI pages
│   │   ├── analytics/
│   │   ├── datasets/
│   │   ├── playground/
│   │   ├── queue/
│   │   ├── runs/
│   │   ├── settings/
│   │   └── tasks/
│   └── api/
│       ├── analytics/
│       ├── auth/            # login, logout, register, me
│       ├── datasets/        # CRUD + import + export + push-to-hub
│       ├── health/
│       ├── llm/             # run, stream, judge, playground
│       ├── models/
│       ├── openapi.json/    # OpenAPI 3.1 spec endpoint
│       ├── queue/
│       ├── reviews/
│       ├── runs/
│       ├── settings/
│       └── tasks/           # CRUD + [id] + [id]/versions
├── components/              # Shared UI components
├── lib/
│   ├── auth.ts              # JWT auth
│   ├── db.ts                # Prisma singleton
│   ├── llm.ts               # callLLM() for all providers
│   ├── llm-cache.ts         # Hash-based caching
│   ├── logger.ts            # Pino logger
│   ├── middleware/          # rate-limit middleware
│   ├── rate-limit.ts        # LRU rate limiter
│   ├── secrets.ts           # encrypt/decrypt API keys
│   ├── store.ts             # Zustand client state
│   ├── theme.tsx            # Dark mode
│   ├── toast.tsx            # Toast notifications
│   ├── utils.ts             # createId, cn()
│   └── validation.ts        # Zod schemas + parseBody
└── types/                   # Shared TypeScript interfaces
```

---

## API Patterns

### Adding a new route

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseBody, z } from '@/lib/validation';
import { createRouteLogger } from '@/lib/logger';
import { prisma } from '@/lib/db';

const log = createRouteLogger('/api/example');

const ExampleSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, ExampleSchema);
  if (error) return error;

  try {
    // ... do work ...
    log.info({ userId: session.sub }, 'example action');
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    log.error({ err }, 'example failed');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### Adding a Zod schema

Add it to `src/lib/validation.ts` alongside existing schemas. Export it. Do not duplicate schemas across files.

---

## Testing Requirements

Every new API route MUST have a `route.test.ts` alongside it. Minimum test cases:
1. `401` when unauthenticated
2. `400` when required fields are missing (Zod catches this)
3. Happy path (`201` / `200` with expected shape)
4. Error path (DB throws, returns `500`)

Mock pattern:
```typescript
vi.mock('@/lib/logger', () => ({
  createRouteLogger: () => ({
    info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn(),
  }),
}));
vi.mock('@/lib/db', () => ({ prisma: { model: { method: vi.fn() } } }));
vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
```

Run tests: `npm run test`
Run with coverage: `npm run test:coverage`

---

## LLM Integration Patterns

When adding a new provider:
1. Add the provider to `callLLM()` switch in `src/lib/llm.ts`
2. Add a `callNewProvider()` private function in `src/lib/llm.ts`
3. Add cost constants to `MODEL_COSTS` in `src/lib/llm.ts`
4. Add streaming support in `src/app/api/llm/stream/route.ts`
5. Add models to `DEFAULT_MODELS` in `src/types/index.ts`

---

## Colour Palette (Enforced)

```
ALLOWED:   sand-*  warmgray-*  slateblue-*
FORBIDDEN: zinc-*  gray-*  neutral-*  slate-*  emerald-*
```

---

## Verification Before Finishing

Before marking a task done, always verify:
```bash
npm run lint          # must pass with 0 errors
npm run typecheck     # must pass with 0 errors
npm run test          # all tests must pass
npm run build         # must succeed
```
