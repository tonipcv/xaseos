'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, TextArea } from '@/components/ui/Input';
import { Plus, Download, Trash2, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { api, exportDataset } from '@/lib/api';

type ExportFormat = 'jsonl' | 'csv' | 'json';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  exportFormat: string;
  createdAt: string;
  runs: { runId: string }[];
}

const EMPTY_FORM = { name: '', description: '', exportFormat: 'jsonl' as ExportFormat };

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [completedRunIds, setCompletedRunIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    api.get<Dataset[]>('/api/datasets').then(setDatasets).catch(console.error);
    api.get<{ id: string; status: string }[]>('/api/runs')
      .then(runs => setCompletedRunIds(runs.filter(r => r.status === 'completed').map(r => r.id)))
      .catch(console.error);
  }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    setLoading(true);
    try {
      const created = await api.post<Dataset>('/api/datasets', {
        ...form,
        runIds: completedRunIds,
      });
      setDatasets(prev => [created, ...prev]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create dataset');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dataset?')) return;
    try {
      await api.delete(`/api/datasets/${id}`);
      setDatasets(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleExport = async (dataset: Dataset, format: ExportFormat) => {
    setExportingId(dataset.id);
    try {
      await exportDataset(dataset.id, format);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingId(null);
    }
  };
  
  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Datasets">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New Dataset
        </Button>
      </Header>
      
      {showCreate && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-warmgray-700">New Dataset</h2>
            <button onClick={() => setShowCreate(false)} className="text-warmgray-400 hover:text-warmgray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <Input label="Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g.: Preference Pairs v1" />
            <TextArea label="Description" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Dataset description" />
            <div>
              <label className="text-sm font-medium text-warmgray-700 mb-2 block">Export Format</label>
              <div className="flex gap-2">
                {(['jsonl', 'csv', 'json'] as ExportFormat[]).map(f => (
                  <button key={f} onClick={() => setForm({ ...form, exportFormat: f })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      form.exportFormat === f ? 'bg-slateblue-700 text-white' : 'bg-sand-200 text-warmgray-600 hover:bg-sand-300'
                    }`}>{f.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} loading={loading}>Create Dataset</Button>
            </div>
          </div>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {datasets.map(dataset => (
          <Card key={dataset.id} className="flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-warmgray-700">{dataset.name}</h3>
              <button onClick={() => handleDelete(dataset.id)} className="text-warmgray-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-warmgray-500 mb-4 line-clamp-2">{dataset.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="neutral">{dataset.runs.length} runs</Badge>
              <Badge variant="neutral">{(dataset.exportFormat ?? 'jsonl').toUpperCase()}</Badge>
            </div>
            <div className="mt-auto pt-3 border-t border-sand-200 space-y-2">
              <p className="text-xs text-warmgray-400">{formatDate(dataset.createdAt)}</p>
              <div className="flex gap-1">
                {(['jsonl', 'csv', 'json'] as ExportFormat[]).map(f => (
                  <Button key={f} variant="secondary" size="sm" className="flex-1"
                    loading={exportingId === dataset.id}
                    onClick={() => handleExport(dataset, f)}>
                    <Download className="w-3 h-3" />{f.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {datasets.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <p className="text-warmgray-500 mb-4">No datasets created</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Create first dataset
          </Button>
        </div>
      )}
    </div>
  );
}
