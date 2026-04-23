'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { BarChart3, DollarSign, Clock, Star, CheckCircle2, Database } from 'lucide-react';

interface Summary {
  tasks: number; totalRuns: number; completedRuns: number;
  totalReviews: number; datasets: number; totalCost: number; totalTokens: number;
}
interface ModelLatency { modelId: string; avgLatency: number; totalResponses: number; errors: number; }
interface ModelScore { modelId: string; avgScore: number; reviewCount: number; }
interface LabelDist { label: string; count: number; }
interface DailyCost { date: string; cost: number | null; }
interface DailyRun { date: string; count: number; }

interface Analytics {
  summary: Summary;
  avgLatencyPerModel: ModelLatency[];
  scoresByModel: ModelScore[];
  labelDistribution: LabelDist[];
  costOverTime: DailyCost[];
  runsOverTime: DailyRun[];
}

const LABEL_COLORS: Record<string, string> = {
  excellent: 'bg-slateblue-700 text-white',
  good: 'bg-slateblue-500 text-white',
  acceptable: 'bg-sand-400 text-warmgray-800',
  poor: 'bg-sand-300 text-warmgray-700',
  failure: 'bg-red-100 text-red-700',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Analytics>('/api/analytics')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-[1600px]">
        <Header title="Analytics" />
        <p className="text-warmgray-500 animate-pulse">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 lg:p-10 max-w-[1600px]">
        <Header title="Analytics" />
        <p className="text-warmgray-500">No data available yet. Run some tasks first.</p>
      </div>
    );
  }

  const { summary, avgLatencyPerModel, scoresByModel, labelDistribution } = data;
  const maxLatency = Math.max(...avgLatencyPerModel.map(m => m.avgLatency), 1);
  const maxScore = 10;
  const totalLabels = labelDistribution.reduce((s, l) => s + l.count, 0);

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Analytics" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Runs" value={summary.totalRuns} icon={<BarChart3 className="w-4 h-4" />} />
        <StatCard label="Completed" value={summary.completedRuns} icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard label="Reviews" value={summary.totalReviews} icon={<Star className="w-4 h-4" />} />
        <StatCard label="Total Cost" value={`$${summary.totalCost.toFixed(4)}`} icon={<DollarSign className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-sm font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-warmgray-400" /> Average Latency by Model
          </h2>
          {avgLatencyPerModel.length === 0 ? (
            <p className="text-sm text-warmgray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {[...avgLatencyPerModel].sort((a, b) => a.avgLatency - b.avgLatency).map(m => (
                <div key={m.modelId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-warmgray-600 truncate max-w-[180px]">{m.modelId}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warmgray-400">{m.totalResponses} calls</span>
                      {m.errors > 0 && <Badge variant="error" className="text-[10px]">{m.errors} err</Badge>}
                      <span className="text-xs font-medium text-warmgray-700">{m.avgLatency}ms</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-sand-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slateblue-500 rounded-full transition-all"
                      style={{ width: `${(m.avgLatency / maxLatency) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-warmgray-400" /> Average Review Score by Model
          </h2>
          {scoresByModel.length === 0 ? (
            <p className="text-sm text-warmgray-400">No reviews yet</p>
          ) : (
            <div className="space-y-3">
              {[...scoresByModel].sort((a, b) => b.avgScore - a.avgScore).map(m => (
                <div key={m.modelId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-warmgray-600 truncate max-w-[180px]">{m.modelId}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-warmgray-400">{m.reviewCount} reviews</span>
                      <span className="text-xs font-medium text-warmgray-700">{m.avgScore}/10</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-sand-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slateblue-700 rounded-full transition-all"
                      style={{ width: `${(m.avgScore / maxScore) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-warmgray-400" /> Review Label Distribution
          </h2>
          {labelDistribution.length === 0 ? (
            <p className="text-sm text-warmgray-400">No reviews yet</p>
          ) : (
            <div className="space-y-2">
              {[...labelDistribution].sort((a, b) => b.count - a.count).map(l => (
                <div key={l.label} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium w-24 text-center ${LABEL_COLORS[l.label] ?? 'bg-sand-200 text-warmgray-600'}`}>
                    {l.label}
                  </span>
                  <div className="flex-1 h-2 bg-sand-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slateblue-500 rounded-full"
                      style={{ width: `${(l.count / totalLabels) * 100}%` }} />
                  </div>
                  <span className="text-xs text-warmgray-500 w-8 text-right">{l.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-warmgray-700 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-warmgray-400" /> Summary
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Tasks created', value: summary.tasks },
              { label: 'Total runs', value: summary.totalRuns },
              { label: 'Completed runs', value: summary.completedRuns },
              { label: 'Expert reviews', value: summary.totalReviews },
              { label: 'Datasets', value: summary.datasets },
              { label: 'Total tokens used', value: summary.totalTokens.toLocaleString() },
              { label: 'Total API cost', value: `$${summary.totalCost.toFixed(6)}` },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-sand-100 last:border-0">
                <span className="text-sm text-warmgray-500">{row.label}</span>
                <span className="text-sm font-medium text-warmgray-700">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
