'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { REVIEW_LABELS } from '@/types';
import type { ReviewLabel } from '@/types';
import { CheckSquare, Clock, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { formatDate, cn } from '@/lib/utils';

interface PendingResponse {
  id: string; runId: string; modelName: string; provider: string;
  content: string; latencyMs: number; createdAt: string; taskName: string; taskPrompt: string;
}

const LABEL_COLORS: Record<string, string> = {
  excellent: 'bg-slateblue-700 text-white',
  good:      'bg-slateblue-500 text-white',
  acceptable:'bg-sand-400 text-warmgray-700',
  poor:      'bg-sand-300 text-warmgray-600',
  failure:   'bg-red-100 text-red-700',
};

export default function QueuePage() {
  const { toast } = useToast();
  const [queue, setQueue] = useState<PendingResponse[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewForm, setReviewForm] = useState({ label: 'good' as ReviewLabel, score: 7, rationale: '', correctedOutput: '' });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PendingResponse[]>('/api/queue');
      setQueue(data);
      setIndex(0);
    } catch {
      toast('Failed to load review queue', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const current = queue[index];

  const handleSubmit = async () => {
    if (!current) return;
    if (!reviewForm.rationale.trim()) { toast('Rationale is required', 'warning'); return; }
    setSaving(true);
    try {
      await api.post('/api/reviews', {
        runId: current.runId,
        modelResponseId: current.id,
        label: reviewForm.label,
        score: reviewForm.score,
        rationale: reviewForm.rationale,
        correctedOutput: reviewForm.correctedOutput || null,
      });
      toast('Review saved ✓', 'success');
      const next = queue.filter((_, i) => i !== index);
      setQueue(next);
      setIndex(Math.min(index, next.length - 1));
      setReviewForm({ label: 'good', score: 7, rationale: '', correctedOutput: '' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save review', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-[1600px]">
        <Header title="Review Queue" />
        <p className="text-warmgray-500 animate-pulse">Loading queue…</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Review Queue">
        <div className="flex items-center gap-3">
          <span className="text-sm text-warmgray-500">{queue.length} pending</span>
          <Button variant="secondary" size="sm" onClick={fetchQueue}>Refresh</Button>
        </div>
      </Header>

      {queue.length === 0 ? (
        <Card className="text-center py-12">
          <CheckSquare className="w-10 h-10 text-slateblue-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-warmgray-700 mb-2">Queue is empty!</h2>
          <p className="text-sm text-warmgray-500 mb-4">All responses have been reviewed.</p>
          <Link href="/runs">
            <Button variant="secondary">View Runs</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Response display */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-warmgray-500 mb-1">{current.taskName}</p>
                  <span className="text-sm font-semibold text-slateblue-700">{current.modelName}</span>
                  <Badge variant="neutral" className="ml-2 capitalize text-[10px]">{current.provider}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-warmgray-400">
                  <Clock className="w-3 h-3" />{current.latencyMs}ms
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs font-medium text-warmgray-500 mb-1">Task Prompt</p>
                <p className="text-xs bg-sand-100 rounded-lg p-3 text-warmgray-600 line-clamp-4">{current.taskPrompt}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-warmgray-500 mb-1">Model Response</p>
                <div className="bg-sand-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-warmgray-700">{current.content}</pre>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-warmgray-400">
                <span>{formatDate(current.createdAt)}</span>
                <Link href={`/runs/${current.runId}`} className="text-slateblue-700 hover:text-slateblue-800">
                  View full run →
                </Link>
              </div>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => { setIndex(i => i - 1); setReviewForm({ label: 'good', score: 7, rationale: '', correctedOutput: '' }); }}>
                <ChevronLeft className="w-4 h-4" />Previous
              </Button>
              <span className="text-xs text-warmgray-500">{index + 1} / {queue.length}</span>
              <Button variant="secondary" size="sm" disabled={index === queue.length - 1} onClick={() => { setIndex(i => i + 1); setReviewForm({ label: 'good', score: 7, rationale: '', correctedOutput: '' }); }}>
                Next<ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Review form */}
          <Card>
            <h2 className="text-sm font-semibold text-warmgray-700 mb-4">Your Review</h2>

            <div className="mb-4">
              <label className="text-xs font-medium text-warmgray-600 block mb-2">Label</label>
              <div className="flex flex-wrap gap-2">
                {REVIEW_LABELS.map(l => (
                  <button key={l.value} onClick={() => setReviewForm(f => ({ ...f, label: l.value }))}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
                      reviewForm.label === l.value ? LABEL_COLORS[l.value] ?? 'bg-slateblue-700 text-white' : 'bg-sand-200 text-warmgray-600 hover:bg-sand-300')}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-warmgray-600 block mb-2">
                Score: <span className="text-slateblue-700 font-bold">{reviewForm.score}</span>/10
              </label>
              <input type="range" min={0} max={10} value={reviewForm.score}
                onChange={e => setReviewForm(f => ({ ...f, score: Number(e.target.value) }))}
                className="w-full accent-slateblue-700" />
              <div className="flex justify-between text-[10px] text-warmgray-400 mt-1">
                <span>Failure (0)</span><span>Excellent (10)</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-warmgray-600 block mb-1">Rationale *</label>
              <textarea value={reviewForm.rationale}
                onChange={e => setReviewForm(f => ({ ...f, rationale: e.target.value }))}
                rows={4} placeholder="Explain your assessment…"
                className="w-full bg-sand-50 border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:outline-none resize-none" />
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-warmgray-600 block mb-1">Corrected Output (optional)</label>
              <textarea value={reviewForm.correctedOutput}
                onChange={e => setReviewForm(f => ({ ...f, correctedOutput: e.target.value }))}
                rows={3} placeholder="Provide a better response if needed…"
                className="w-full bg-sand-50 border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:outline-none resize-none" />
            </div>

            <Button onClick={handleSubmit} loading={saving} className="w-full">
              <Star className="w-4 h-4" />Submit Review
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
