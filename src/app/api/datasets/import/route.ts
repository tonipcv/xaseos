import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createId } from '@/lib/utils';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/datasets/import');

interface ImportRow {
  prompt?: string;
  instruction?: string;
  input?: string;
  response?: string;
  output?: string;
  completion?: string;
  model?: string;
  system_prompt?: string;
  score?: number;
  label?: string;
  rationale?: string;
}

function parseRows(text: string): ImportRow[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  // JSONL
  return trimmed.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function normalizePrompt(row: ImportRow): string {
  return row.prompt ?? row.instruction ?? row.input ?? '';
}

function normalizeSystemPrompt(row: ImportRow): string | undefined {
  return row.system_prompt ?? undefined;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const datasetName = (formData.get('name') as string) || 'Imported Dataset';

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const text = await file.text();
    let rows: ImportRow[];
    try {
      rows = parseRows(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON or JSONL format' }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows found in file' }, { status: 400 });
    }

    // Group rows by (userPrompt, systemPrompt) to create one task per unique prompt pair
    const rowsByPrompt = new Map<string, ImportRow[]>();
    for (const row of rows.slice(0, 500)) {
      const userPrompt = normalizePrompt(row);
      const systemPrompt = normalizeSystemPrompt(row);
      const key = JSON.stringify({ userPrompt, systemPrompt });
      if (!rowsByPrompt.has(key)) rowsByPrompt.set(key, []);
      rowsByPrompt.get(key)!.push(row);
    }

    const runIds: string[] = [];

    // Create one task per unique prompt, then runs for each row
    for (const [, groupRows] of Array.from(rowsByPrompt.entries())) {
      const firstRow = groupRows[0];
      const userPrompt = normalizePrompt(firstRow);
      const systemPrompt = normalizeSystemPrompt(firstRow);

      // Skip empty groups
      if (!userPrompt && groupRows.every((r: ImportRow) => !(r.response ?? r.output ?? r.completion))) continue;

      const taskId = createId();
      await prisma.task.create({
        data: {
          id: taskId,
          userId: session.sub,
          name: `[Import] ${datasetName}`,
          description: `Imported from ${file.name}`,
          userPrompt,
          systemPrompt,
          modelIds: [],
        },
      });

      for (const row of groupRows) {
        const responseText = row.response ?? row.output ?? row.completion ?? '';
        const modelId = row.model ?? 'imported';

        if (!responseText) continue;

        const runId = createId();
        await prisma.run.create({
          data: {
            id: runId,
            userId: session.sub,
            taskId,
            taskName: datasetName,
            status: 'completed',
            completedAt: new Date(),
          },
        });

        const responseId = createId();
        await prisma.modelResponse.create({
          data: {
            id: responseId,
            runId,
            modelId,
            modelName: modelId,
            provider: 'imported',
            content: responseText,
            latencyMs: 0,
          },
        });

        // If the row includes a review, import it too
        if (row.score !== undefined || row.label) {
          await prisma.expertReview.create({
            data: {
              id: createId(),
              runId,
              modelResponseId: responseId,
              reviewerId: session.sub,
              label: row.label ?? 'good',
              score: row.score ?? 7,
              rationale: row.rationale ?? 'Imported from dataset',
              status: 'imported',
            },
          });
        }

        runIds.push(runId);
      }
    }

    // Create a dataset linking all runs
    const datasetId = createId();
    await prisma.dataset.create({
      data: {
        id: datasetId,
        userId: session.sub,
        name: datasetName,
        description: `Imported from ${file.name} (${rows.length} rows, ${rowsByPrompt.size} unique prompts)`,
        exportFormat: 'jsonl',
      },
    });

    if (runIds.length > 0) {
      await prisma.datasetRun.createMany({
        data: runIds.map(runId => ({ datasetId, runId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ datasetId, imported: runIds.length, uniquePrompts: rowsByPrompt.size });
  } catch (err) {
    log.error({ err }, 'import failed');
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
