'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PlayCircle, CheckCircle2, Clock, Database, ArrowRight, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';

interface AnalyticsSummary {
  tasks: number; totalRuns: number; completedRuns: number; failedRuns?: number;
  totalReviews: number; datasets: number; totalCost: number; totalTokens: number;
}
interface Run { id: string; taskName: string; status: string; createdAt: string; responsesCount: number; costEstimate?: number; }
interface Task { id: string; name: string; modelIds: string[]; createdAt: string; }

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);

  useEffect(() => {
    api.get<{ summary: AnalyticsSummary }>('/api/analytics')
      .then(d => setSummary(d.summary)).catch(console.error);
    api.get<Run[]>('/api/runs?summary=1&limit=5').then(setRecentRuns).catch(console.error);
    api.get<Task[]>('/api/tasks').then(t => setRecentTasks(t.slice(0, 5))).catch(console.error);
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Dashboard" />
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tasks" value={summary?.tasks ?? 0} icon={<PlayCircle className="w-4 h-4" />} />
        <StatCard label="Completed Runs" value={summary?.completedRuns ?? 0} icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard label="Reviews" value={summary?.totalReviews ?? 0} icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Total Cost" value={`$${(summary?.totalCost ?? 0).toFixed(4)}`} icon={<DollarSign className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-sand-300 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-warmgray-700">Recent Runs</h2>
            <Link href="/runs" className="text-xs text-slateblue-700 hover:text-slateblue-800 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          {recentRuns.length === 0 ? (
            <p className="text-sm text-warmgray-500">No runs yet. Create a task and run it.</p>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <Link 
                  key={run.id} 
                  href={`/runs/${run.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-sand-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-warmgray-700">{run.taskName}</p>
                    <p className="text-xs text-warmgray-500">{formatDate(run.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-warmgray-500">{run.responsesCount} responses</p>
                    <p className="text-xs text-warmgray-400">{run.costEstimate ? `$${run.costEstimate.toFixed(4)}` : ''}</p>
                  </div>
                  <Badge 
                    variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'warning'}
                    dot
                  >
                    {run.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-sand-300 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-warmgray-700">Recent Tasks</h2>
            <Link href="/tasks" className="text-xs text-slateblue-700 hover:text-slateblue-800 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          {recentTasks.length === 0 ? (
            <p className="text-sm text-warmgray-500">No tasks created. Create your first task.</p>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <Link 
                  key={task.id} 
                  href={`/tasks/${task.id}/run`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-sand-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-warmgray-700">{task.name}</p>
                    <p className="text-xs text-warmgray-500">{task.modelIds.length} models</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-warmgray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
