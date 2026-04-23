import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'jsonl';
  const label = url.searchParams.get('label') ?? null;
  const minScore = parseInt(url.searchParams.get('minScore') ?? '0');

  const dataset = await prisma.dataset.findFirst({
    where: { id: params.id, userId: session.sub },
    include: {
      runs: {
        include: {
          run: {
            include: {
              task: true,
              responses: {
                include: {
                  reviews: {
                    include: { reviewer: { select: { name: true, email: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entries: unknown[] = [];

  for (const dr of dataset.runs) {
    const run = dr.run;
    const task = run.task;
    for (const resp of run.responses) {
      if (resp.error) continue;

      for (const review of resp.reviews) {
        if (label && review.label !== label) continue;
        if (review.score < minScore) continue;

        const entry = {
          messages: [
            ...(task?.systemPrompt ? [{ role: 'system', content: task.systemPrompt }] : []),
            { role: 'user', content: task?.userPrompt ?? '' },
            { role: 'assistant', content: review.correctedOutput || resp.content || '' },
          ],
          metadata: {
            model: resp.modelId,
            modelName: resp.modelName,
            provider: resp.provider,
            label: review.label,
            score: review.score,
            rationale: review.rationale,
            reviewer: review.reviewer.name || review.reviewer.email,
            runId: run.id,
            responseId: resp.id,
          },
        };
        entries.push(entry);
      }

      if (resp.reviews.length === 0) {
        const entry = {
          messages: [
            ...(task?.systemPrompt ? [{ role: 'system', content: task.systemPrompt }] : []),
            { role: 'user', content: task?.userPrompt ?? '' },
            { role: 'assistant', content: resp.content || '' },
          ],
          metadata: {
            model: resp.modelId,
            modelName: resp.modelName,
            provider: resp.provider,
            label: null,
            score: null,
            runId: run.id,
            responseId: resp.id,
          },
        };
        entries.push(entry);
      }
    }
  }

  const filename = `${dataset.name.replace(/\s+/g, '_').toLowerCase()}`;

  if (format === 'jsonl') {
    const body = entries.map(e => JSON.stringify(e)).join('\n');
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': `attachment; filename="${filename}.jsonl"`,
      },
    });
  }

  if (format === 'csv') {
    const rows = entries.map((e: any) => {
      const sys = e.messages.find((m: any) => m.role === 'system')?.content ?? '';
      const usr = e.messages.find((m: any) => m.role === 'user')?.content ?? '';
      const ast = e.messages.find((m: any) => m.role === 'assistant')?.content ?? '';
      return [sys, usr, ast, e.metadata.model, e.metadata.label ?? '', e.metadata.score ?? '']
        .map((v: any) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = ['system,user,assistant,model,label,score', ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(entries, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}.json"`,
    },
  });
}
