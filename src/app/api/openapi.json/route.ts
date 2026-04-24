import { NextResponse } from 'next/server';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Xase OS API',
    version: '0.2.0',
    description:
      'REST API for the Xase OS LLM evaluation and fine-tuning data platform.',
    license: { name: 'Apache 2.0', url: 'https://github.com/tonipcv/xaseos/blob/main/LICENSE' },
    contact: { name: 'Xase AI', url: 'https://github.com/tonipcv/xaseos' },
  },
  servers: [
    { url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002', description: 'Current environment' },
  ],
  tags: [
    { name: 'tasks', description: 'Evaluation tasks' },
    { name: 'llm', description: 'LLM execution endpoints' },
    { name: 'reviews', description: 'Expert review management' },
    { name: 'datasets', description: 'Fine-tuning dataset management' },
    { name: 'analytics', description: 'Aggregated analytics' },
    { name: 'queue', description: 'Annotation queue' },
  ],
  paths: {
    '/api/tasks': {
      get: {
        tags: ['tasks'],
        summary: 'List tasks',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: 'Array of tasks' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['tasks'],
        summary: 'Create a task',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'userPrompt'],
                properties: {
                  name: { type: 'string', maxLength: 200 },
                  description: { type: 'string', maxLength: 2000 },
                  systemPrompt: { type: 'string', maxLength: 10000 },
                  userPrompt: { type: 'string', maxLength: 50000 },
                  modelIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Task created' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/tasks/{id}': {
      put: {
        tags: ['tasks'],
        summary: 'Update a task (creates version snapshot)',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated task' }, '401': { description: 'Unauthorized' }, '404': { description: 'Not found' } },
      },
      delete: {
        tags: ['tasks'],
        summary: 'Delete a task',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' }, '401': { description: 'Unauthorized' }, '404': { description: 'Not found' } },
      },
    },
    '/api/tasks/{id}/versions': {
      get: {
        tags: ['tasks'],
        summary: 'Get task version history',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Array of task versions' } },
      },
    },
    '/api/llm/run': {
      post: {
        tags: ['llm'],
        summary: 'Run a task across all configured models (parallel)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['taskId'],
                properties: { taskId: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Run results with all model responses' },
          '400': { description: 'Validation error or missing API key' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Task not found' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/llm/stream': {
      post: {
        tags: ['llm'],
        summary: 'Stream a response from a single model via SSE',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['modelId', 'provider', 'userPrompt'],
                properties: {
                  modelId: { type: 'string' },
                  provider: { type: 'string' },
                  systemPrompt: { type: 'string' },
                  userPrompt: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'SSE stream — events: delta, done, error', content: { 'text/event-stream': {} } },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/llm/judge': {
      post: {
        tags: ['llm'],
        summary: 'Automated LLM-as-a-Judge scoring',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Judge score and rationale' } },
      },
    },
    '/api/llm/playground': {
      post: {
        tags: ['llm'],
        summary: 'Test a single model interactively',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Model response' } },
      },
    },
    '/api/reviews': {
      post: {
        tags: ['reviews'],
        summary: 'Create or update an expert review',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['runId', 'modelResponseId', 'label', 'score', 'rationale'],
                properties: {
                  runId: { type: 'string' },
                  modelResponseId: { type: 'string' },
                  label: { type: 'string', enum: ['excellent', 'good', 'acceptable', 'poor', 'failure'] },
                  score: { type: 'number', minimum: 0, maximum: 10 },
                  rationale: { type: 'string' },
                  correctedOutput: { type: 'string' },
                  status: { type: 'string', enum: ['done', 'flagged', 'skip'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Review saved' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Run or response not found' },
        },
      },
    },
    '/api/datasets': {
      get: { tags: ['datasets'], summary: 'List datasets', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Array of datasets' } } },
      post: {
        tags: ['datasets'],
        summary: 'Create a dataset',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  exportFormat: { type: 'string', enum: ['jsonl', 'csv', 'json'] },
                  runIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Dataset created' }, '400': { description: 'Validation error' } },
      },
    },
    '/api/datasets/{id}/export': {
      get: {
        tags: ['datasets'],
        summary: 'Download dataset file',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['jsonl', 'csv', 'json'] } },
        ],
        responses: { '200': { description: 'File download' } },
      },
    },
    '/api/datasets/{id}/push-to-hub': {
      post: {
        tags: ['datasets'],
        summary: 'Push dataset to HuggingFace Hub',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Push result' } },
      },
    },
    '/api/datasets/import': {
      post: {
        tags: ['datasets'],
        summary: 'Import JSON/JSONL file as runs',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Import result' } },
      },
    },
    '/api/queue': {
      get: {
        tags: ['queue'],
        summary: 'Get pending unreviewed responses',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Pending responses' } },
      },
    },
    '/api/analytics': {
      get: {
        tags: ['analytics'],
        summary: 'Get full analytics payload',
        security: [{ cookieAuth: [] }],
        responses: { '200': { description: 'Analytics data' } },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'auth_token',
        description: 'JWT auth cookie. Obtained via POST /api/auth/login.',
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
