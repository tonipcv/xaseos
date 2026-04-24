'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Play, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Task {
  id: string; name: string; description?: string;
  systemPrompt?: string; userPrompt: string; modelIds: string[];
}
interface Model { id: string; name: string; provider: string; enabled: boolean; }
interface RunResponse {
  success: boolean;
  runId: string;
  responses: unknown[];
  costEstimate: number;
}

export default function RunTaskPage() {
  const { id } = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.get<Task>(`/api/tasks/${id}`).then(setTask).catch(console.error);
    api.get<Model[]>('/api/models').then(setModels).catch(console.error);
    api.get<{ provider: string }[]>('/api/settings/keys').then(keys => {
      setConfiguredProviders(keys.map(k => k.provider));
    }).catch(console.error);
  }, [id]);

  if (!task) {
    return (
      <div className="p-6 lg:p-10 max-w-[1600px]">
        <div className="text-center py-12">
          <p className="text-warmgray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const taskModels = models.filter(m => task.modelIds.includes(m.id));
  const missingKeys = Array.from(new Set(taskModels.map(m => m.provider)))
    .filter(p => !configuredProviders.includes(p) && p !== 'ollama');

  const handleRun = async () => {
    setRunning(true);
    try {
      const run = await api.post<RunResponse>('/api/llm/run', { taskId: task.id });
      if (!run.runId) {
        throw new Error('Run did not return an id');
      }
      router.push(`/runs/${run.runId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Run failed');
      setRunning(false);
    }
  };
  
  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Run Task">
        <Link href="/tasks">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
      </Header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-warmgray-700 mb-4">Task Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-warmgray-500 uppercase tracking-wide">Name</label>
              <p className="text-sm font-medium text-warmgray-700">{task.name}</p>
            </div>
            
            <div>
              <label className="text-xs text-warmgray-500 uppercase tracking-wide">Description</label>
              <p className="text-sm text-warmgray-700">{task.description || '-'}</p>
            </div>
            
            {task.systemPrompt && (
              <div>
                <label className="text-xs text-warmgray-500 uppercase tracking-wide">System Prompt</label>
                <pre className="mt-1 text-xs bg-sand-100 p-3 rounded-lg overflow-x-auto">
                  {task.systemPrompt}
                </pre>
              </div>
            )}
            
            <div>
              <label className="text-xs text-warmgray-500 uppercase tracking-wide">User Prompt</label>
              <pre className="mt-1 text-xs bg-sand-100 p-3 rounded-lg overflow-x-auto">
                {task.userPrompt}
              </pre>
            </div>
          </div>
        </Card>
        
        <Card>
          <h2 className="text-sm font-semibold text-warmgray-700 mb-4">Selected Models</h2>
          
          <div className="space-y-3 mb-6">
            {taskModels.map((model) => (
              <div key={model.id} className="flex items-center justify-between p-3 bg-sand-100 rounded-lg">
                <span className="text-sm font-medium text-warmgray-700">{model.name}</span>
                <Badge variant="neutral" className="capitalize">{model.provider}</Badge>
              </div>
            ))}
          </div>
          
          {missingKeys.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-700">
                  Configure API keys in <Link href="/settings" className="underline">Settings</Link> for: {missingKeys.join(', ')}
                </p>
              </div>
              <Link href="/settings" className="text-xs text-red-600 hover:text-red-700 mt-1 inline-block">
                Configure in Settings
              </Link>
            </div>
          )}
          
          <Button
            onClick={handleRun}
            loading={running}
            disabled={running || taskModels.length === 0}
            className="w-full"
            size="lg"
          >
            <Play className="w-4 h-4" />
            {running ? 'Running...' : 'Run Task'}
          </Button>
          
          {running && (
            <div className="mt-4 text-center">
              <p className="text-sm text-warmgray-500 animate-pulse">Running models on server...</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
