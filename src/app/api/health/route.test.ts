import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/db';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe('/api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when DB is connected', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([1]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services.database).toBe('connected');
    expect(data.timestamp).toBeDefined();
  });

  it('should return unhealthy status when DB is disconnected', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.services.database).toBe('disconnected');
    expect(data.services.error).toBe('Connection refused');
  });
});
