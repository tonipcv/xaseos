'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { REVIEW_LABELS } from '@/types';
import type { ReviewLabel } from '@/types';
import Link from 'next/link';
import { ArrowLeft, Clock, MessageSquare, CheckCircle2, AlertCircle, Star, RotateCcw, Columns, List, DollarSign } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface Review {
  id: string; label: string; score: number; rationale: string;
  correctedOutput?: string; status: string; reviewedAt: string;
  reviewer: { id: string; name?: string; email: string };
}
interface Response {
  id: string; modelId: string; modelName: string; provider: string;
  content?: string; latencyMs: number; tokensUsed?: number;
  inputTokens?: number; outputTokens?: number; cost?: number; error?: string;
  reviews: Review[];
}
interface Run {
  id: string; taskId: string; taskName: string; status: string;
  createdAt: string; completedAt?: string; costEstimate?: number;
  responses: Response[];
}

export default function RunDetailPage() {
  const { id } = useParams();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [sideBySide, setSideBySide] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    label: 'good' as ReviewLabel,
    score: 7,
    rationale: '',
    correctedOutput: '',
  });

  const fetchRun = useCallback(async () => {
    try {
      const data = await api.get<Run>(`/api/runs/${id}`);
      setRun(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  useEffect(() => {
    api.get<{ user: { id: string } }>('/api/auth/me')
      .then(data => setCurrentUserId(data.user.id))
      .catch(() => setCurrentUserId(null));
  }, []);

  const getPreferredReview = (reviews: Review[]) => {
    if (reviews.length === 0) return null;
    if (currentUserId) {
      const ownReview = reviews.find(review => review.reviewer.id === currentUserId);
      if (ownReview) return ownReview;
    }
    return reviews[reviews.length - 1] ?? null;
  };

  const handleRetry = async () => {
    if (!run) return;
    setRetrying(true);
    try {
      const updated = await api.post<Run>(`/api/runs/${id}/retry`, {});
      setRun(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const openReview = (resp: Response) => {
    const existing = getPreferredReview(resp.reviews);
    setSelectedResponse(resp);
    setReviewForm({
      label: (existing?.label ?? 'good') as ReviewLabel,
      score: existing?.score ?? 7,
      rationale: existing?.rationale ?? '',
      correctedOutput: existing?.correctedOutput ?? '',
    });
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedResponse || !run) return;
    setSavingReview(true);
    try {
      await api.post('/api/reviews', {
        runId: run.id,
        modelResponseId: selectedResponse.id,
        label: reviewForm.label,
        score: reviewForm.score,
        rationale: reviewForm.rationale,
        correctedOutput: reviewForm.correctedOutput || null,
      });
      await fetchRun();
      setShowReviewModal(false);
      setSelectedResponse(null);
      setReviewForm({ label: 'good', score: 7, rationale: '', correctedOutput: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-[1600px]">
        <p className="text-warmgray-500">Loading run...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6 lg:p-10 max-w-[1600px]">
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-warmgray-500">Run not found</p>
          <Link href="/runs" className="text-slateblue-700 hover:text-slateblue-800 text-sm mt-2 inline-block">Back to runs</Link>
        </div>
      </div>
    );
  }

  const failedCount = run.responses.filter(r => r.error).length;
  const totalCost = run.costEstimate ?? 0;

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title={`Run: ${run.taskName}`}>
        <div className="flex items-center gap-2">
          <Link href="/runs">
            <Button variant="secondary" size="sm"><ArrowLeft className="w-4 h-4" />Back</Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setSideBySide(v => !v)}>
            {sideBySide ? <List className="w-4 h-4" /> : <Columns className="w-4 h-4" />}
            {sideBySide ? 'List' : 'Side-by-side'}
          </Button>
          {failedCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleRetry} loading={retrying}>
              <RotateCcw className="w-4 h-4" />Retry Failed
            </Button>
          )}
        </div>
      </Header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-warmgray-400" />
          <div>
            <p className="text-xs text-warmgray-500 uppercase tracking-wide">Created</p>
            <p className="text-sm font-medium text-warmgray-700">{formatDate(run.createdAt)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-warmgray-400" />
          <div>
            <p className="text-xs text-warmgray-500 uppercase tracking-wide">Status</p>
            <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'warning'} dot>{run.status}</Badge>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-warmgray-400" />
          <div>
            <p className="text-xs text-warmgray-500 uppercase tracking-wide">Responses</p>
            <p className="text-sm font-medium text-warmgray-700">{run.responses.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-warmgray-400" />
          <div>
            <p className="text-xs text-warmgray-500 uppercase tracking-wide">Cost</p>
            <p className="text-sm font-medium text-warmgray-700">${totalCost.toFixed(4)}</p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-warmgray-700">Model Responses</h2>

        {sideBySide ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-white border border-sand-300 rounded-xl text-sm">
              <thead>
                <tr className="bg-sand-100">
                  <th className="text-left p-3 text-warmgray-600 font-medium">Model</th>
                  <th className="text-left p-3 text-warmgray-600 font-medium">Provider</th>
                  <th className="text-left p-3 text-warmgray-600 font-medium">Latency</th>
                  <th className="text-left p-3 text-warmgray-600 font-medium">Tokens</th>
                  <th className="text-left p-3 text-warmgray-600 font-medium">Cost</th>
                  <th className="text-left p-3 text-warmgray-600 font-medium">Review</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {run.responses.map(r => {
                  const activeReview = getPreferredReview(r.reviews);
                  return (
                    <tr key={r.id} className="border-t border-sand-200">
                      <td className="p-3 text-warmgray-700 font-medium">{r.modelName}</td>
                      <td className="p-3 text-warmgray-500 capitalize">{r.provider}</td>
                      <td className="p-3 text-warmgray-500">{r.latencyMs}ms</td>
                      <td className="p-3 text-warmgray-500">{r.tokensUsed ?? '-'}</td>
                      <td className="p-3 text-warmgray-500">${(r.cost ?? 0).toFixed(4)}</td>
                      <td className="p-3">
                        {activeReview ? (
                          <Badge variant={
                            activeReview.label === 'excellent' ? 'success' : activeReview.label === 'good' ? 'info' : activeReview.label === 'acceptable' ? 'warning' : activeReview.label === 'poor' ? 'warning' : 'error'
                          }>{activeReview.label}</Badge>
                        ) : <span className="text-warmgray-400 text-xs">-</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-warmgray-400">{r.reviews.length} review{r.reviews.length === 1 ? '' : 's'}</span>
                          <Button variant="secondary" size="sm" onClick={() => openReview(r)}>Review</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {run.responses.map(r => {
              const activeReview = getPreferredReview(r.reviews);
              const hasReview = !!activeReview;
              return (
                <Card key={r.id} className={cn('flex flex-col',
                  hasReview && 'border-l-4',
                  hasReview && activeReview.label === 'excellent' && 'border-l-slateblue-500',
                  hasReview && activeReview.label === 'good' && 'border-l-blue-500',
                  hasReview && activeReview.label === 'acceptable' && 'border-l-yellow-500',
                  hasReview && activeReview.label === 'poor' && 'border-l-orange-500',
                  hasReview && activeReview.label === 'failure' && 'border-l-red-500',
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-warmgray-700">{r.modelName}</h3>
                      {hasReview && <><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /><span className="text-xs font-medium text-warmgray-600">{activeReview.score}/10</span></>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warmgray-500">{r.latencyMs}ms</span>
                      {r.tokensUsed && <span className="text-xs text-warmgray-500">{r.tokensUsed} tokens</span>}
                    </div>
                  </div>
                  {r.error ? (
                    <div className="p-3 bg-red-50 rounded-lg mb-3"><p className="text-sm text-red-600">{r.error}</p></div>
                  ) : (
                    <pre className="text-xs bg-sand-100 p-3 rounded-lg overflow-x-auto mb-3 flex-1 max-h-[300px] overflow-y-auto">{r.content}</pre>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-sand-200">
                    {hasReview ? (
                      <div className="flex items-center gap-2">
                        <Badge variant={activeReview.label === 'excellent' ? 'success' : activeReview.label === 'good' ? 'info' : activeReview.label === 'acceptable' ? 'warning' : activeReview.label === 'poor' ? 'warning' : 'error'}>{activeReview.label}</Badge>
                        <span className="text-xs text-warmgray-400">{r.reviews.length} review{r.reviews.length === 1 ? '' : 's'}</span>
                      </div>
                    ) : <span className="text-xs text-warmgray-400">No review</span>}
                    <Button variant="secondary" size="sm" onClick={() => openReview(r)}>{hasReview ? 'Edit' : 'Review'}</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showReviewModal && selectedResponse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-warmgray-700">Review: {selectedResponse.modelName}</h2>
              <button onClick={() => setShowReviewModal(false)} className="text-warmgray-400 hover:text-warmgray-600 text-xl">×</button>
            </div>
            <div className="space-y-4">
              {selectedResponse.reviews.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-warmgray-700 mb-2 block">Review History</label>
                  <div className="space-y-2">
                    {selectedResponse.reviews.map(review => {
                      const isCurrentUser = currentUserId && review.reviewer.id === currentUserId;
                      return (
                        <div
                          key={review.id}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs',
                            isCurrentUser ? 'border-slateblue-300 bg-slateblue-50' : 'border-sand-200 bg-sand-50'
                          )}
                        >
                          <div>
                            <p className="font-medium text-warmgray-700">
                              {review.reviewer.name ?? review.reviewer.email}
                              {isCurrentUser ? ' (you)' : ''}
                            </p>
                            <p className="text-warmgray-500">{formatDate(review.reviewedAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={review.label === 'excellent' ? 'success' : review.label === 'good' ? 'info' : review.label === 'acceptable' ? 'warning' : review.label === 'poor' ? 'warning' : 'error'}>
                              {review.label}
                            </Badge>
                            <span className="text-warmgray-500">{review.score}/10</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-warmgray-700 mb-2 block">Label</label>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_LABELS.map(lbl => (
                    <button key={lbl.value} onClick={() => setReviewForm({ ...reviewForm, label: lbl.value })}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', reviewForm.label === lbl.value ? 'bg-slateblue-700 text-white' : 'bg-sand-200 text-warmgray-600 hover:bg-sand-300')}>
                      {lbl.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-warmgray-700 mb-2 block">Score: {reviewForm.score}/10</label>
                <input type="range" min="0" max="10" value={reviewForm.score} onChange={e => setReviewForm({ ...reviewForm, score: parseInt(e.target.value) })} className="w-full" />
              </div>
              <div>
                <label className="text-sm font-medium text-warmgray-700 mb-2 block">Rationale</label>
                <textarea value={reviewForm.rationale} onChange={e => setReviewForm({ ...reviewForm, rationale: e.target.value })}
                  placeholder="Explain your assessment..." className="w-full min-h-[100px] bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none resize-y" />
              </div>
              <div>
                <label className="text-sm font-medium text-warmgray-700 mb-2 block">Corrected Output (optional)</label>
                <textarea value={reviewForm.correctedOutput} onChange={e => setReviewForm({ ...reviewForm, correctedOutput: e.target.value })}
                  placeholder="Paste corrected version..." className="w-full min-h-[100px] bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none resize-y" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={() => setShowReviewModal(false)}>Cancel</Button>
                <Button onClick={handleSubmitReview} loading={savingReview}>Save Review</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
