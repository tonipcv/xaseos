# xaseos

Xase OS is an LLM Evaluation Platform built with Next.js 14 + React + TypeScript + PostgreSQL.

## Features

- **Multi-Provider LLM Integration**: Run evaluation tasks across OpenAI, Anthropic, Google, Grok, Groq, and Ollama
- **Side-by-Side Comparison**: Compare model responses side-by-side with cost and latency tracking
- **Expert Review System**: Structured reviews with labels (excellent/good/acceptable/poor/failure), scores (1-10), and corrections
- **Response Caching**: Automatic caching to reduce API costs for identical prompts
- **Dataset Export**: Export training data in JSONL, CSV, or JSON format
- **Analytics Dashboard**: Cost tracking, latency metrics, and review distributions

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: JWT-based with httpOnly cookies
- **Security**: Encrypted API keys, environment-based secrets

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and JWT secret

# Run migrations
npm run migrate

# Generate Prisma client
npx prisma generate

# Seed test user
DATABASE_URL="your-db-url" node scripts/seed.js

# Start development server
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Min 32 characters for auth tokens | Yes |
| `NEXT_PUBLIC_APP_URL` | App URL (default: http://localhost:3002) | No |

## Project Structure

```
├── prisma/           # Database schema and migrations
├── scripts/          # Utility scripts (seed, migrate)
├── src/
│   ├── app/          # Next.js app routes
│   ├── components/   # React components
│   ├── lib/          # Utilities (auth, db, llm, cache)
│   └── types/        # TypeScript types
├── public/           # Static assets
└── .env.example      # Environment template
```

## License

MIT
