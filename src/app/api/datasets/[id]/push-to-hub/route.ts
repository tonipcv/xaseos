import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createRouteLogger } from '@/lib/logger';

const log = createRouteLogger('/api/datasets/[id]/push-to-hub');

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { hfToken, repoId } = await req.json();
    if (!hfToken || !repoId) {
      return NextResponse.json({ error: 'hfToken and repoId are required' }, { status: 400 });
    }

    const dataset = await prisma.dataset.findFirst({ where: { id: params.id, userId: session.sub } });
    if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

    // Load dataset rows
    const datasetRuns = await prisma.datasetRun.findMany({
      where: { datasetId: params.id },
      include: {
        run: {
          include: {
            responses: { include: { reviews: { orderBy: { reviewedAt: 'desc' } } } },
            task: true,
          },
        },
      },
    });

    const rows: Record<string, unknown>[] = [];
    for (const dr of datasetRuns) {
      for (const resp of dr.run.responses) {
        if (!resp.content) continue;
        // Include ALL reviews for this response (multi-reviewer support)
        const reviews = resp.reviews.map(r => ({
          label: r.label,
          score: r.score,
          rationale: r.rationale,
          status: r.status,
          reviewedAt: r.reviewedAt,
        }));
        rows.push({
          prompt: dr.run.task.userPrompt,
          system_prompt: dr.run.task.systemPrompt ?? null,
          response: resp.content,
          model: resp.modelName,
          provider: resp.provider,
          reviews: reviews.length > 0 ? reviews : null,
          // Backward-compatible single-review fields (first review)
          label: reviews[0]?.label ?? null,
          score: reviews[0]?.score ?? null,
          rationale: reviews[0]?.rationale ?? null,
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Dataset has no valid rows to export' }, { status: 400 });
    }

    const jsonlContent = rows.map(r => JSON.stringify(r)).join('\n');
    const encodedContent = Buffer.from(jsonlContent).toString('base64');

    // Create repo if it doesn't exist
    await fetch(`https://huggingface.co/api/repos/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dataset', name: repoId, private: false }),
    });

    // Upload the JSONL file
    const uploadRes = await fetch(
      `https://huggingface.co/api/datasets/${repoId}/upload/data/train.jsonl`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: encodedContent,
          encoding: 'base64',
          message: `Upload dataset: ${dataset.name}`,
        }),
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return NextResponse.json({ error: `HuggingFace upload failed: ${err}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url: `https://huggingface.co/datasets/${repoId}`, rows: rows.length });
  } catch (err) {
    log.error({ err }, 'push to hub failed');
    return NextResponse.json({ error: 'Push to Hub failed' }, { status: 500 });
  }
}
