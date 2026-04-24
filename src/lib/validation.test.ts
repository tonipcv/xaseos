import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  parseBody,
  TaskCreateSchema,
  TaskUpdateSchema,
  ReviewCreateSchema,
  DatasetCreateSchema,
  LLMRunSchema,
  LLMStreamSchema,
  z,
} from './validation';

function makeReq(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/test'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeBadReq(): NextRequest {
  return new NextRequest(new URL('http://localhost/test'), {
    method: 'POST',
    body: 'not-json{{{',
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseBody', () => {
  it('returns data on valid input', async () => {
    const schema = z.object({ name: z.string() });
    const { data, error } = await parseBody(makeReq({ name: 'hello' }), schema);
    expect(error).toBeNull();
    expect(data?.name).toBe('hello');
  });

  it('returns 400 on invalid JSON', async () => {
    const schema = z.object({ name: z.string() });
    const { data, error } = await parseBody(makeBadReq(), schema);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    const body = await error!.json();
    expect(body.error).toBe('Invalid JSON body');
    expect(error!.status).toBe(400);
  });

  it('returns 400 with details on schema mismatch', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const { data, error } = await parseBody(makeReq({ name: '' }), schema);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    const body = await error!.json();
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
  });
});

describe('TaskCreateSchema', () => {
  it('accepts valid task', () => {
    const result = TaskCreateSchema.safeParse({ name: 'Test', userPrompt: 'Hello' });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = TaskCreateSchema.safeParse({ userPrompt: 'Hello' });
    expect(result.success).toBe(false);
  });

  it('rejects missing userPrompt', () => {
    const result = TaskCreateSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('applies default modelIds', () => {
    const result = TaskCreateSchema.safeParse({ name: 'Test', userPrompt: 'Hi' });
    expect(result.success && result.data.modelIds).toEqual([]);
  });

  it('rejects name longer than 200 chars', () => {
    const result = TaskCreateSchema.safeParse({ name: 'a'.repeat(201), userPrompt: 'Hi' });
    expect(result.success).toBe(false);
  });
});

describe('TaskUpdateSchema', () => {
  it('accepts partial update', () => {
    const result = TaskUpdateSchema.safeParse({ name: 'New name' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = TaskUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('ReviewCreateSchema', () => {
  const valid = {
    runId: 'run-1',
    modelResponseId: 'resp-1',
    label: 'good',
    score: 7,
    rationale: 'Good answer.',
  };

  it('accepts valid review', () => {
    expect(ReviewCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid label', () => {
    expect(ReviewCreateSchema.safeParse({ ...valid, label: 'amazing' }).success).toBe(false);
  });

  it('rejects score > 10', () => {
    expect(ReviewCreateSchema.safeParse({ ...valid, score: 11 }).success).toBe(false);
  });

  it('rejects score < 0', () => {
    expect(ReviewCreateSchema.safeParse({ ...valid, score: -1 }).success).toBe(false);
  });

  it('applies default status of done', () => {
    const result = ReviewCreateSchema.safeParse(valid);
    expect(result.success && result.data.status).toBe('done');
  });
});

describe('DatasetCreateSchema', () => {
  it('accepts minimal dataset', () => {
    expect(DatasetCreateSchema.safeParse({ name: 'DS' }).success).toBe(true);
  });

  it('rejects invalid exportFormat', () => {
    expect(DatasetCreateSchema.safeParse({ name: 'DS', exportFormat: 'excel' }).success).toBe(false);
  });

  it('applies default exportFormat of jsonl', () => {
    const result = DatasetCreateSchema.safeParse({ name: 'DS' });
    expect(result.success && result.data.exportFormat).toBe('jsonl');
  });

  it('applies default runIds of []', () => {
    const result = DatasetCreateSchema.safeParse({ name: 'DS' });
    expect(result.success && result.data.runIds).toEqual([]);
  });
});

describe('LLMRunSchema', () => {
  it('accepts valid taskId', () => {
    expect(LLMRunSchema.safeParse({ taskId: 'task-1' }).success).toBe(true);
  });

  it('rejects empty taskId', () => {
    expect(LLMRunSchema.safeParse({ taskId: '' }).success).toBe(false);
  });

  it('rejects missing taskId', () => {
    expect(LLMRunSchema.safeParse({}).success).toBe(false);
  });
});

describe('LLMStreamSchema', () => {
  it('accepts valid stream request', () => {
    expect(LLMStreamSchema.safeParse({
      modelId: 'gpt-4o',
      provider: 'openai',
      userPrompt: 'Hello',
    }).success).toBe(true);
  });

  it('rejects missing provider', () => {
    expect(LLMStreamSchema.safeParse({ modelId: 'gpt-4o', userPrompt: 'Hi' }).success).toBe(false);
  });
});
