import { z } from 'zod';
import { NextResponse } from 'next/server';

export { z };

export async function parseBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`);
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Validation failed', details: messages },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}

// ─── Shared schemas ───────────────────────────────────────────────────────────

export const TaskCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(10000).optional(),
  userPrompt: z.string().min(1, 'userPrompt is required').max(50000),
  modelIds: z.array(z.string()).optional().default([]),
});

export const TaskUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  systemPrompt: z.string().max(10000).nullable().optional(),
  userPrompt: z.string().min(1).max(50000).optional(),
  modelIds: z.array(z.string()).optional(),
});

export const ReviewCreateSchema = z.object({
  runId: z.string().min(1),
  modelResponseId: z.string().min(1),
  label: z.enum(['excellent', 'good', 'acceptable', 'poor', 'failure']),
  score: z.number().min(0).max(10),
  rationale: z.string().min(1, 'rationale is required').max(5000),
  correctedOutput: z.string().max(50000).optional(),
  status: z.enum(['done', 'flagged', 'skip']).optional().default('done'),
});

export const DatasetCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().max(2000).optional(),
  exportFormat: z.enum(['jsonl', 'csv', 'json']).optional().default('jsonl'),
  runIds: z.array(z.string()).optional().default([]),
});

export const LLMRunSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
});

export const LLMPlaygroundSchema = z.object({
  modelId: z.string().min(1),
  systemPrompt: z.string().max(10000).optional(),
  userPrompt: z.string().min(1).max(50000),
  provider: z.string().min(1),
});

export const LLMStreamSchema = z.object({
  modelId: z.string().min(1),
  provider: z.string().min(1),
  systemPrompt: z.string().max(10000).optional(),
  userPrompt: z.string().min(1).max(50000),
});

export const LLMJudgeSchema = z.object({
  runId: z.string().min(1),
  modelResponseId: z.string().min(1),
  content: z.string().min(1),
  taskPrompt: z.string().min(1),
});
