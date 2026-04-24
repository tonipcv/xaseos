'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { formatDate, cn } from '@/lib/utils';
import { ArrowRight, Clock, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface Run {
  id: string; taskName: string; status: string; createdAt: string;
  costEstimate?: number; responses: { id: string }[];
}

type SortField = 'createdAt' | 'taskName' | 'status' | 'costEstimate';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ['all', 'completed', 'running', 'failed', 'pending'] as const;

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<Run[]>('/api/runs').then(setRuns).catch(console.error);
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = runs;
    if (search) list = list.filter(r => r.taskName.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'taskName') cmp = a.taskName.localeCompare(b.taskName);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortField === 'costEstimate') cmp = (a.costEstimate ?? 0) - (b.costEstimate ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [runs, search, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortTh = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th className="text-left font-medium text-warmgray-700 py-3 px-4 cursor-pointer select-none hover:text-slateblue-700"
      onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn('w-3 h-3 transition-opacity', sortField === field ? 'opacity-100 text-slateblue-700' : 'opacity-30')} />
      </span>
    </th>
  );

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Runs" />

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by task name…"
          className="bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none w-56" />
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                statusFilter === s ? 'bg-slateblue-700 text-white' : 'bg-sand-200 text-warmgray-600 hover:bg-sand-300')}>
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-warmgray-400 self-center">{filtered.length} results</span>
      </div>

      <div className="bg-white border border-sand-300 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand-100 border-b border-sand-300">
            <tr>
              <SortTh field="taskName">Task</SortTh>
              <SortTh field="status">Status</SortTh>
              <th className="text-left font-medium text-warmgray-700 py-3 px-4">Responses</th>
              <SortTh field="costEstimate">Cost</SortTh>
              <SortTh field="createdAt">Created</SortTh>
              <th className="text-right font-medium text-warmgray-700 py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {paged.map((run) => (
              <tr key={run.id} className="hover:bg-sand-50/50">
                <td className="py-3 px-4">
                  <p className="font-medium text-warmgray-700">{run.taskName}</p>
                  <p className="text-[10px] text-warmgray-400 font-mono">{run.id.slice(0, 8)}…</p>
                </td>
                <td className="py-3 px-4">
                  <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'warning'} dot>
                    {run.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-warmgray-600">{run.responses.length}</td>
                <td className="py-3 px-4 text-warmgray-500">
                  {run.costEstimate ? `$${run.costEstimate.toFixed(4)}` : '-'}
                </td>
                <td className="py-3 px-4 text-warmgray-500">{formatDate(run.createdAt)}</td>
                <td className="py-3 px-4 text-right">
                  <Link href={`/runs/${run.id}`} className="inline-flex items-center gap-1 text-slateblue-700 hover:text-slateblue-800">
                    View<ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-8 h-8 text-sand-400 mx-auto mb-3" />
            <p className="text-warmgray-500">{search || statusFilter !== 'all' ? 'No runs match your filters' : 'No runs yet'}</p>
            {!search && statusFilter === 'all' && (
              <Link href="/tasks" className="text-sm text-slateblue-700 hover:text-slateblue-800 mt-2 inline-block">Go to Tasks</Link>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-sand-200 bg-sand-50">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />Prev
            </Button>
            <span className="text-xs text-warmgray-500">Page {page} / {totalPages}</span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next<ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
