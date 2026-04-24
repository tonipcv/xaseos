import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  createRouteLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    run: { findFirst: vi.fn() },
    modelResponse: { findFirst: vi.fn() },
    expertReview: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

function makeReq(body: object): NextRequest {
  return new NextRequest(new URL('http://localhost/api/reviews'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const mockUser = { sub: 'user-1', email: 'a@b.com', role: 'user' };
const validBody = {
  runId: 'run-1',
  modelResponseId: 'resp-1',
  label: 'good',
  score: 7,
  rationale: 'Good answer overall.',
};

describe('/api/reviews POST', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid label enum', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    const res = await POST(makeReq({ ...validBody, label: 'wrong' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when score is out of range', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    const res = await POST(makeReq({ ...validBody, score: 11 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when rationale is missing', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    const { rationale: _r, ...noRationale } = validBody;
    const res = await POST(makeReq(noRationale));
    expect(res.status).toBe(400);
  });

  it('returns 404 when run not found', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.run.findFirst).mockResolvedValueOnce(null);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
  });

  it('returns 404 when modelResponse not found', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.run.findFirst).mockResolvedValueOnce({ id: 'run-1' } as never);
    vi.mocked(prisma.modelResponse.findFirst).mockResolvedValueOnce(null);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
  });

  it('creates a new review when none exists', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.run.findFirst).mockResolvedValueOnce({ id: 'run-1' } as never);
    vi.mocked(prisma.modelResponse.findFirst).mockResolvedValueOnce({ id: 'resp-1' } as never);
    vi.mocked(prisma.expertReview.findFirst).mockResolvedValueOnce(null);
    const mockReview = { id: 'review-1', ...validBody, reviewerId: mockUser.sub, reviewer: { id: mockUser.sub, name: 'Alice', email: mockUser.email } };
    vi.mocked(prisma.expertReview.create).mockResolvedValueOnce(mockReview as never);

    const res = await POST(makeReq(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe('review-1');
    expect(prisma.expertReview.create).toHaveBeenCalledOnce();
    expect(prisma.expertReview.update).not.toHaveBeenCalled();
  });

  it('updates an existing review', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.run.findFirst).mockResolvedValueOnce({ id: 'run-1' } as never);
    vi.mocked(prisma.modelResponse.findFirst).mockResolvedValueOnce({ id: 'resp-1' } as never);
    vi.mocked(prisma.expertReview.findFirst).mockResolvedValueOnce({ id: 'existing-review' } as never);
    const updated = { id: 'existing-review', ...validBody, reviewer: {} };
    vi.mocked(prisma.expertReview.update).mockResolvedValueOnce(updated as never);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    expect(prisma.expertReview.update).toHaveBeenCalledOnce();
    expect(prisma.expertReview.create).not.toHaveBeenCalled();
  });
});
