import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
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
    dataset: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    run: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));

const mockUser = { sub: 'user-1', email: 'a@b.com', role: 'user' };

function makeReq(body: object): NextRequest {
  return new NextRequest(new URL('http://localhost/api/datasets'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/datasets GET', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns datasets for authenticated user', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    const mockDatasets = [
      { id: 'ds-1', name: 'Dataset 1', _count: { runs: 5 }, runs: [] },
    ];
    vi.mocked(prisma.dataset.findMany).mockResolvedValueOnce(mockDatasets as never);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('ds-1');
  });
});

describe('/api/datasets POST', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await POST(makeReq({ name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for invalid exportFormat', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    const res = await POST(makeReq({ name: 'DS', exportFormat: 'excel' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('creates dataset with no runs', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    const mockDS = { id: 'ds-new', name: 'New DS', runs: [] };
    vi.mocked(prisma.dataset.create).mockResolvedValueOnce(mockDS as never);

    const res = await POST(makeReq({ name: 'New DS' }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe('ds-new');
    expect(prisma.run.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 when runIds contain invalid/incomplete runs', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.run.findMany).mockResolvedValueOnce([]);

    const res = await POST(makeReq({ name: 'DS', runIds: ['run-nonexistent'] }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/invalid or not completed/);
  });

  it('creates dataset with valid runIds', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(mockUser);
    vi.mocked(prisma.run.findMany).mockResolvedValueOnce([{ id: 'run-1' }] as never);
    const mockDS = { id: 'ds-new', name: 'DS with runs', runs: [{ runId: 'run-1' }] };
    vi.mocked(prisma.dataset.create).mockResolvedValueOnce(mockDS as never);

    const res = await POST(makeReq({ name: 'DS with runs', runIds: ['run-1'] }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe('ds-new');
  });
});
