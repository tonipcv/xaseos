'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, TextArea } from '@/components/ui/Input';
import { Database, Plus, Trash2, Download, X, Upload, Send, ExternalLink } from 'lucide-react';
import { api, exportDataset } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/lib/toast';

type ExportFormat = 'jsonl' | 'csv' | 'json';
interface Dataset { id: string; name: string; description?: string; exportFormat: string; createdAt: string; runs: { runId: string }[]; _count?: { runs: number }; }
interface RunOption { id: string; taskName: string; createdAt: string; }
const EMPTY_FORM = { name: '', description: '', exportFormat: 'jsonl' as ExportFormat };

export default function DatasetsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [availableRuns, setAvailableRuns] = useState<RunOption[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [hfModal, setHfModal] = useState<Dataset | null>(null);
  const [hfToken, setHfToken] = useState('');
  const [hfRepo, setHfRepo] = useState('');
  const [pushing, setPushing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Lightweight dataset list (without nested responses)
    api.get<Dataset[]>('/api/datasets').then(setDatasets).catch(console.error);
    // Load available runs for selection
    api.get<RunOption[]>('/api/runs?status=completed&limit=100&fields=id,taskName,createdAt')
      .then(setAvailableRuns).catch(console.error);
  }, []);

  const handleCreate = async () => {
    if (!form.name) { toast('Name is required', 'warning'); return; }
    if (selectedRunIds.length === 0) { toast('Select at least one run', 'warning'); return; }
    setLoading(true);
    try {
      const created = await api.post<Dataset>('/api/datasets', { ...form, runIds: selectedRunIds });
      setDatasets(prev => [created, ...prev]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setSelectedRunIds([]);
      toast('Dataset created', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create dataset', 'error');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dataset?')) return;
    try {
      await api.delete(`/api/datasets/${id}`);
      setDatasets(prev => prev.filter(d => d.id !== id));
      toast('Dataset deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const handleExport = async (dataset: Dataset, format: ExportFormat) => {
    setExportingId(dataset.id);
    try {
      await exportDataset(dataset.id, format);
      toast('Download started', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally { setExportingId(null); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const name = file.name.replace(/\.(json|jsonl)$/, '');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name);
      const res = await fetch('/api/datasets/import', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Imported ${data.imported} rows into "${name}"`, 'success');
      const refreshed = await api.get<Dataset[]>('/api/datasets');
      setDatasets(refreshed);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePushToHub = async () => {
    if (!hfModal || !hfToken || !hfRepo) { toast('Fill in all fields', 'warning'); return; }
    setPushing(true);
    try {
      const res = await api.post<{ ok: boolean; url: string; rows: number }>(
        `/api/datasets/${hfModal.id}/push-to-hub`, { hfToken, repoId: hfRepo }
      );
      toast(`Pushed ${res.rows} rows to HuggingFace! View at ${res.url}`, 'success', 8000);
      setHfModal(null);
      setHfToken(''); setHfRepo('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Push to Hub failed', 'error');
    } finally { setPushing(false); }
  };

  const filtered = datasets.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Datasets">
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".json,.jsonl" className="hidden" onChange={handleImport} />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} loading={importing}>
            <Upload className="w-4 h-4" />Import JSON/JSONL
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />New Dataset
          </Button>
        </div>
      </Header>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search datasets…"
          className="w-full max-w-sm bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none" />
      </div>

      {/* Create Dataset Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-warmgray-700">New Dataset</h2>
              <button onClick={() => setShowCreate(false)} className="text-warmgray-400 hover:text-warmgray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g.: Preference Pairs v1" />
              <TextArea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Dataset description" />
              <div>
                <label className="text-sm font-medium text-warmgray-700 mb-2 block">Default Export Format</label>
                <div className="flex gap-2">
                  {(['jsonl', 'csv', 'json'] as ExportFormat[]).map(f => (
                    <button key={f} onClick={() => setForm({ ...form, exportFormat: f })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.exportFormat === f ? 'bg-slateblue-700 text-white' : 'bg-sand-200 text-warmgray-600 hover:bg-sand-300'}`}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-warmgray-700 mb-2 block">Select Runs ({selectedRunIds.length} selected)</label>
                <div className="max-h-48 overflow-y-auto border border-sand-300 rounded-lg p-2 space-y-1">
                  {availableRuns.length === 0 ? (
                    <p className="text-xs text-warmgray-400">No completed runs available</p>
                  ) : (
                    availableRuns.map(run => (
                      <label key={run.id} className="flex items-center gap-2 p-1.5 hover:bg-sand-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRunIds.includes(run.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedRunIds(prev => [...prev, run.id]);
                            else setSelectedRunIds(prev => prev.filter(id => id !== run.id));
                          }}
                          className="rounded border-sand-300 text-slateblue-700 focus:ring-slateblue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-warmgray-700 truncate">{run.taskName}</p>
                          <p className="text-[10px] text-warmgray-400">{formatDate(run.createdAt)}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} loading={loading} disabled={selectedRunIds.length === 0}>Create Dataset</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(dataset => (
          <Card key={dataset.id} className="flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-warmgray-700">{dataset.name}</h3>
              <button onClick={() => handleDelete(dataset.id)} className="text-warmgray-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-warmgray-500 mb-3 line-clamp-2">{dataset.description}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="neutral">{dataset.runs.length} runs</Badge>
              <Badge variant="neutral">{(dataset.exportFormat ?? 'jsonl').toUpperCase()}</Badge>
            </div>
            <div className="mt-auto pt-3 border-t border-sand-200 space-y-2">
              <p className="text-xs text-warmgray-400">{formatDate(dataset.createdAt)}</p>
              <div className="flex gap-1">
                {(['jsonl', 'csv', 'json'] as ExportFormat[]).map(f => (
                  <Button key={f} variant="secondary" size="sm" className="flex-1"
                    loading={exportingId === dataset.id} onClick={() => handleExport(dataset, f)}>
                    <Download className="w-3 h-3" />{f.toUpperCase()}
                  </Button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setHfModal(dataset); setHfRepo(''); setHfToken(''); }}>
                <Send className="w-3.5 h-3.5" />Push to HuggingFace
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <Database className="w-8 h-8 text-sand-400 mx-auto mb-3" />
          <p className="text-warmgray-500 mb-4">{search ? 'No datasets match your search' : 'No datasets yet'}</p>
          {!search && <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Create first dataset</Button>}
        </div>
      )}

      {/* HuggingFace Push Modal */}
      {hfModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-warmgray-700">Push to HuggingFace Hub</h2>
              <button onClick={() => setHfModal(null)} className="text-warmgray-400 hover:text-warmgray-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-warmgray-500 mb-4">Dataset: <strong>{hfModal.name}</strong> ({hfModal.runs.length} runs)</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-warmgray-700 block mb-1">HuggingFace Token</label>
                <input type="password" value={hfToken} onChange={e => setHfToken(e.target.value)}
                  placeholder="hf_…" className="w-full bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:outline-none" />
                <p className="text-[10px] text-warmgray-400 mt-1">Get your token at <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-slateblue-700 underline">huggingface.co/settings/tokens</a></p>
              </div>
              <div>
                <label className="text-xs font-medium text-warmgray-700 block mb-1">Repository ID</label>
                <input value={hfRepo} onChange={e => setHfRepo(e.target.value)}
                  placeholder="username/dataset-name" className="w-full bg-white border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setHfModal(null)}>Cancel</Button>
                <Button onClick={handlePushToHub} loading={pushing}>
                  <Send className="w-4 h-4" />Push to Hub
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
