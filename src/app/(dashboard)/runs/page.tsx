'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { ArrowRight, Clock, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';

interface Run {
  id: string; taskName: string; status: string; createdAt: string;
  costEstimate?: number; responses: { id: string }[];
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    api.get<Run[]>('/api/runs').then(setRuns).catch(console.error);
  }, []);

  const sortedRuns = [...runs].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Runs" />
      
      <div className="bg-white border border-sand-300 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-300">
            <tr>
              <th className="text-left font-medium text-warmgray-700 py-3 px-4">Task</th>
              <th className="text-left font-medium text-warmgray-700 py-3 px-4">Status</th>
              <th className="text-left font-medium text-warmgray-700 py-3 px-4">Responses</th>
              <th className="text-left font-medium text-warmgray-700 py-3 px-4">Cost</th>
              <th className="text-left font-medium text-warmgray-700 py-3 px-4">Created</th>
              <th className="text-right font-medium text-warmgray-700 py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {sortedRuns.map((run) => (
              <tr key={run.id} className="hover:bg-sand-50/50">
                <td className="py-3 px-4">
                  <p className="font-medium text-warmgray-700">{run.taskName}</p>
                </td>
                <td className="py-3 px-4">
                  <Badge 
                    variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'warning'}
                    dot
                  >
                    {run.status}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <span className="text-warmgray-600">{run.responses.length} responses</span>
                </td>
                <td className="py-3 px-4 text-warmgray-500">
                  {run.costEstimate ? `$${run.costEstimate.toFixed(4)}` : '-'}
                </td>
                <td className="py-3 px-4 text-warmgray-500">
                  {formatDate(run.createdAt)}
                </td>
                <td className="py-3 px-4 text-right">
                  <Link 
                    href={`/runs/${run.id}`}
                    className="inline-flex items-center gap-1 text-slateblue-700 hover:text-slateblue-800"
                  >
                    View
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {runs.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-8 h-8 text-sand-400 mx-auto mb-3" />
            <p className="text-warmgray-500">No runs yet</p>
            <Link href="/tasks" className="text-sm text-slateblue-700 hover:text-slateblue-800 mt-2 inline-block">
              Go to Tasks
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
