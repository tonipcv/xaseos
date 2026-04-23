'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, TextArea } from '@/components/ui/Input';
import { Plus, Trash2, Play, ArrowRight, X, Pencil } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface Task {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  userPrompt: string;
  modelIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
}

const EMPTY_FORM = { name: '', description: '', systemPrompt: '', userPrompt: '' };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Task[]>('/api/tasks').then(setTasks).catch(console.error);
    api.get<Model[]>('/api/models').then(setModels).catch(console.error);
    api.get<{ provider: string }[]>('/api/settings/keys').then(keys => {
      setConfiguredProviders(keys.map(k => k.provider));
    }).catch(console.error);
  }, []);

  const openCreate = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setSelectedModelIds(models.filter(m => m.enabled).map(m => m.id));
    setShowForm(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({ name: task.name, description: task.description ?? '', systemPrompt: task.systemPrompt ?? '', userPrompt: task.userPrompt });
    setSelectedModelIds(task.modelIds);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.userPrompt) return;
    if (selectedModelIds.length === 0) { alert('Select at least one model'); return; }
    setLoading(true);
    try {
      if (editingTask) {
        const updated = await api.put<Task>(`/api/tasks/${editingTask.id}`, { ...form, modelIds: selectedModelIds });
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await api.post<Task>('/api/tasks', { ...form, modelIds: selectedModelIds });
        setTasks(prev => [created, ...prev]);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const toggleModel = (id: string) =>
    setSelectedModelIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const missingApiKeys = Array.from(new Set(models.filter(m => selectedModelIds.includes(m.id)).map(m => m.provider)))
    .filter(p => !configuredProviders.includes(p));
  
  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Tasks">
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </Header>

      {missingApiKeys.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Configure API keys in Settings for: {missingApiKeys.join(', ')}
          </p>
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-warmgray-700">
              {editingTask ? 'Edit Task' : 'New Task'}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-warmgray-400 hover:text-warmgray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <Input label="Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g.: Medical Diagnosis" />

            <Input label="Description" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the task" />

            <TextArea label="System Prompt (optional)" value={form.systemPrompt}
              onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder="System instructions for the LLMs" />

            <TextArea label="User Prompt" value={form.userPrompt}
              onChange={e => setForm({ ...form, userPrompt: e.target.value })}
              placeholder="The prompt that will be sent to all models" />

            <div>
              <label className="text-sm font-medium text-warmgray-700 mb-2 block">Models</label>
              <div className="flex flex-wrap gap-2">
                {models.map(model => (
                  <button key={model.id} onClick={() => toggleModel(model.id)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      selectedModelIds.includes(model.id)
                        ? 'bg-slateblue-700 text-white'
                        : 'bg-sand-200 text-warmgray-600 hover:bg-sand-300')}>
                    {model.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} loading={loading}>
                {editingTask ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map(task => (
          <Card key={task.id} className="flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-warmgray-700">{task.name}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(task)} className="text-warmgray-400 hover:text-slateblue-700 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(task.id)} className="text-warmgray-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-warmgray-500 mb-4 line-clamp-2">{task.description}</p>

            <div className="flex flex-wrap gap-1 mb-4">
              {task.modelIds.slice(0, 3).map(m => (
                <Badge key={m} variant="neutral" className="text-[10px]">
                  {models.find(model => model.id === m)?.name || m}
                </Badge>
              ))}
              {task.modelIds.length > 3 && (
                <Badge variant="neutral" className="text-[10px]">+{task.modelIds.length - 3}</Badge>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-sand-200 flex gap-2">
              <Link href={`/tasks/${task.id}/run`} className="flex-1">
                <Button variant="primary" size="sm" className="w-full">
                  <Play className="w-3.5 h-3.5" />Run
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => openEdit(task)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {tasks.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-warmgray-500 mb-4">No tasks created yet</p>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Create first task
          </Button>
        </div>
      )}
    </div>
  );
}
