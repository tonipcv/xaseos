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

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Helper to create NextRequest
function createNextRequest(body?: object, method = 'GET'): NextRequest {
  const url = new URL('http://localhost:3000/api/tasks');
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/tasks', () => {
  const mockUser = { sub: 'user-123', email: 'test@example.com', role: 'user' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const response = await GET();

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return tasks for authenticated user', async () => {
      vi.mocked(getSession).mockResolvedValueOnce(mockUser);
      const mockTasks = [
        {
          id: 'task-1',
          name: 'Task 1',
          userId: mockUser.sub,
          description: null,
          systemPrompt: null,
          userPrompt: 'Test prompt 1',
          modelIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          name: 'Task 2',
          userId: mockUser.sub,
          description: null,
          systemPrompt: null,
          userPrompt: 'Test prompt 2',
          modelIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(prisma.task.findMany).mockResolvedValueOnce(mockTasks);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe('task-1');
      expect(data[0].name).toBe('Task 1');
      expect(data[1].id).toBe('task-2');
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.sub },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('POST', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const request = createNextRequest({ name: 'Test Task' }, 'POST');

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 when name is missing', async () => {
      vi.mocked(getSession).mockResolvedValueOnce(mockUser);

      const request = createNextRequest({}, 'POST');

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(Array.isArray(data.details)).toBe(true);
    });

    it('should return 400 when userPrompt is missing', async () => {
      vi.mocked(getSession).mockResolvedValueOnce(mockUser);

      const request = createNextRequest({ name: 'My Task' }, 'POST');

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should create task successfully', async () => {
      vi.mocked(getSession).mockResolvedValueOnce(mockUser);
      const mockTask = {
        id: 'task-123',
        name: 'Test Task',
        userId: mockUser.sub,
        description: null,
        systemPrompt: null,
        userPrompt: 'Test prompt',
        modelIds: ['gpt-4o'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.task.create).mockResolvedValueOnce(mockTask);

      const request = createNextRequest({
        name: 'Test Task',
        userPrompt: 'Test prompt',
        modelIds: ['gpt-4o'],
      }, 'POST');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('task-123');
      expect(data.name).toBe('Test Task');
      expect(data.userPrompt).toBe('Test prompt');
    });
  });
});
