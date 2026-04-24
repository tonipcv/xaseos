'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Play, Clock, Zap, DollarSign, Copy, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface Model { id: string; name: string; provider: string; enabled: boolean; }
interface PlayResult {
  modelId: string; modelName: string; provider: string;
  content: string; latencyMs: number; tokensUsed: number; cost: number; error?: string;
}

export default function PlaygroundPage() {
  const { toast } = useToast();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [result, setResult] = useState<PlayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ prompt: string; result: PlayResult }[]>([]);

  useEffect(() => {
    api.get<Model[]>('/api/models').then(ms => {
      setModels(ms);
      if (ms.length > 0) setSelectedModel(ms[0].id);
    }).catch(console.error);
  }, []);

  const handleRun = async () => {
    if (!userPrompt.trim()) { toast('User prompt is required', 'warning'); return; }
    if (!selectedModel) { toast('Select a model', 'warning'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post<PlayResult>('/api/llm/playground', {
        modelId: selectedModel,
        systemPrompt: systemPrompt || undefined,
        userPrompt,
      });
      setResult(res);
      if (!res.error) {
        setHistory(prev => [{ prompt: userPrompt, result: res }, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Playground run failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (result?.content) {
      navigator.clipboard.writeText(result.content);
      toast('Copied to clipboard', 'success');
    }
  };

  const restoreHistory = (h: { prompt: string; result: PlayResult }) => {
    setUserPrompt(h.prompt);
    setSelectedModel(h.result.modelId);
    setResult(h.result);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Prompt Playground" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Model selector */}
          <Card>
            <label className="text-xs font-medium text-warmgray-600 uppercase tracking-wide mb-2 block">Model</label>
            <div className="flex flex-wrap gap-2">
              {models.map(m => (
                <button key={m.id} onClick={() => setSelectedModel(m.id)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    selectedModel === m.id ? 'bg-slateblue-700 text-white' : 'bg-sand-200 text-warmgray-600 hover:bg-sand-300')}>
                  {m.name}
                </button>
              ))}
            </div>
          </Card>

          {/* System prompt */}
          <Card>
            <label className="text-xs font-medium text-warmgray-600 uppercase tracking-wide mb-2 block">System Prompt (optional)</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={3}
              placeholder="System instructions…"
              className="w-full bg-sand-50 border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none resize-none"
            />
          </Card>

          {/* User prompt */}
          <Card>
            <label className="text-xs font-medium text-warmgray-600 uppercase tracking-wide mb-2 block">User Prompt</label>
            <textarea
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              rows={6}
              placeholder="What would you like to ask the model?"
              className="w-full bg-sand-50 border border-sand-300 rounded-lg px-3 py-2 text-sm focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none resize-none"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun(); }}
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-warmgray-400">{userPrompt.length} chars · ⌘↵ to run</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setUserPrompt(''); setSystemPrompt(''); setResult(null); }}>
                  <RotateCcw className="w-3.5 h-3.5" />Clear
                </Button>
                <Button onClick={handleRun} loading={loading} size="sm">
                  <Play className="w-3.5 h-3.5" />Run
                </Button>
              </div>
            </div>
          </Card>

          {/* Result */}
          {result && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slateblue-700">{result.modelName}</span>
                  <span className="flex items-center gap-1 text-xs text-warmgray-500">
                    <Clock className="w-3 h-3" />{result.latencyMs}ms
                  </span>
                  <span className="flex items-center gap-1 text-xs text-warmgray-500">
                    <Zap className="w-3 h-3" />{result.tokensUsed ?? 0} tokens
                  </span>
                  {result.cost > 0 && (
                    <span className="flex items-center gap-1 text-xs text-warmgray-500">
                      <DollarSign className="w-3 h-3" />${result.cost.toFixed(5)}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={copyResult}>
                  <Copy className="w-3.5 h-3.5" />Copy
                </Button>
              </div>
              {result.error ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{result.error}</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-warmgray-700 bg-sand-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {result.content}
                </pre>
              )}
            </Card>
          )}
        </div>

        {/* Right: History */}
        <div>
          <Card>
            <h2 className="text-xs font-semibold text-warmgray-600 uppercase tracking-wide mb-3">History</h2>
            {history.length === 0 ? (
              <p className="text-xs text-warmgray-400">No history yet. Run a prompt to start.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <button key={i} onClick={() => restoreHistory(h)}
                    className="w-full text-left p-2.5 rounded-lg bg-sand-100 hover:bg-sand-200 transition-colors">
                    <p className="text-xs font-medium text-warmgray-600 truncate">{h.prompt.slice(0, 60)}{h.prompt.length > 60 ? '…' : ''}</p>
                    <p className="text-[10px] text-warmgray-400 mt-0.5">{h.result.modelName} · {h.result.latencyMs}ms</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
