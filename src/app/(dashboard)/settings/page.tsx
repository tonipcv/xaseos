'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Plus, Trash2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ApiKeyStatus { id: string; provider: string; hasKey: boolean; createdAt: string; needsRekey?: boolean; }
interface Model { id: string; name: string; provider: string; enabled: boolean; }

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', color: 'bg-green-500' },
  { id: 'anthropic', name: 'Anthropic', color: 'bg-orange-500' },
  { id: 'google', name: 'Google', color: 'bg-blue-500' },
  { id: 'grok', name: 'xAI / Grok', color: 'bg-gray-800' },
  { id: 'groq', name: 'Groq', color: 'bg-purple-500' },
  { id: 'ollama', name: 'Ollama (Local)', color: 'bg-amber-600' },
];

function maskKey(key: string): string {
  if (!key || key.length < 12) return '';
  return `sk-...${key.slice(-4)}`;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyStatus[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [tempKey, setTempKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const fetchData = () => {
    api.get<ApiKeyStatus[]>('/api/settings/keys').then(setKeys).catch(console.error);
    api.get<Model[]>('/api/models').then(setModels).catch(console.error);
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (providerId: string) => {
    setSelectedProvider(providerId);
    setTempKey('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProvider(null);
    setTempKey('');
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !tempKey.trim()) return;
    setSavingKey(true);
    try {
      await api.post('/api/settings/keys', { provider: selectedProvider, keyValue: tempKey.trim() });
      await fetchData();
      handleCloseModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    if (!confirm(`Remove ${providerId} API key?`)) return;
    try {
      await api.delete('/api/settings/keys', { provider: providerId });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete key');
    }
  };

  const handleToggleModel = async (modelId: string, enabled: boolean) => {
    try {
      await api.patch('/api/models', { modelId, enabled });
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, enabled } : m));
    } catch (err) {
      console.error(err);
    }
  };

  const hasKey = (providerId: string) => keys.some(k => k.provider === providerId && k.hasKey);
  const getProviderModels = (providerId: string) => models.filter(m => m.provider === providerId);
  const getEnabledCount = (providerId: string) => getProviderModels(providerId).filter(m => m.enabled).length;

  return (
    <div className="p-6 lg:p-10 max-w-[1600px]">
      <Header title="Settings" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Providers Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-warmgray-700">AI Providers</h2>
            <p className="text-xs text-warmgray-500">Add API keys to unlock models</p>
          </div>

          {PROVIDERS.map((provider) => {
            const providerHasKey = hasKey(provider.id);
            const providerNeedsRekey = keys.some(k => k.provider === provider.id && k.needsRekey);
            const isExpanded = expandedProvider === provider.id;
            const providerModels = getProviderModels(provider.id);
            const enabledCount = getEnabledCount(provider.id);

            return (
              <Card key={provider.id} className={cn(
                "transition-all",
                providerHasKey && "border-l-4 border-l-slateblue-500"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", provider.color)} />
                    <div>
                      <h3 className="text-sm font-semibold text-warmgray-700">{provider.name}</h3>
                      {providerHasKey ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="success" className="text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" />Connected
                          </Badge>
                          {providerNeedsRekey && (
                            <Badge variant="warning" className="text-[10px]">
                              Re-save key
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-warmgray-400">No API key configured</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {providerHasKey && (
                      <button onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                        className="text-warmgray-400 hover:text-warmgray-600 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                    {providerHasKey ? (
                      <button onClick={() => handleDeleteKey(provider.id)}
                        className="text-warmgray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => handleOpenModal(provider.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Add Key
                      </Button>
                    )}
                  </div>
                </div>

                {providerHasKey && isExpanded && (
                  <div className="mt-4 pt-4 border-t border-sand-200">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-warmgray-500 uppercase tracking-wide">Models</p>
                      <p className="text-xs text-warmgray-400">{enabledCount} of {providerModels.length} enabled</p>
                    </div>
                    <div className="space-y-2">
                      {providerModels.map(model => (
                        <div key={model.id} className="flex items-center justify-between p-2.5 bg-sand-100 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full", model.enabled ? "bg-slateblue-500" : "bg-sand-300")} />
                            <span className="text-sm text-warmgray-700">{model.name}</span>
                          </div>
                          <button onClick={() => handleToggleModel(model.id, !model.enabled)}
                            className={cn('relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
                              model.enabled ? 'bg-slateblue-500' : 'bg-sand-300')}>
                            <span className={cn('inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform',
                              model.enabled ? 'translate-x-3.5' : 'translate-x-0.5')} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Info Column */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-warmgray-700">Security</h2>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Server-side Storage</p>
                <p className="text-xs text-yellow-700 mt-1">
                  API keys are stored in your account and used only on the server to run models.
                </p>
                <p className="text-xs text-yellow-700 mt-2">
                  If you see a Re-save key badge, the saved value came from the old encrypted format and needs to be saved again once.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-sand-100 rounded-lg p-4">
            <p className="text-sm font-medium text-warmgray-700 mb-2">How it works</p>
            <ul className="space-y-2 text-xs text-warmgray-600">
              <li className="flex items-start gap-2">
                <span className="text-slateblue-500 font-medium">1.</span>
                Add your API key for a provider
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slateblue-500 font-medium">2.</span>
                Select which models you want to use
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slateblue-500 font-medium">3.</span>
                Keys are masked in the UI after saving
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slateblue-500 font-medium">4.</span>
                Remove key anytime to disable all models
              </li>
            </ul>
          </div>

          <div className="bg-sand-100 rounded-lg p-4">
            <p className="text-xs text-warmgray-500">
              <strong className="text-warmgray-700">Active Providers:</strong>{' '}
              {keys.filter(k => k.hasKey).length} of {PROVIDERS.length}
            </p>
            <p className="text-xs text-warmgray-500 mt-1">
              <strong className="text-warmgray-700">Active Models:</strong>{' '}
              {models.filter(m => m.enabled).length} of {models.length}
            </p>
          </div>
        </div>
      </div>

      {/* Modal for adding API key */}
      {modalOpen && selectedProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-warmgray-700">
                Add {PROVIDERS.find(p => p.id === selectedProvider)?.name} API Key
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-warmgray-400 hover:text-warmgray-600 text-xl"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-warmgray-500 mb-4">
              Your API key will be stored locally in your browser and never shared.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-warmgray-700 mb-1.5 block">
                  API Key
                </label>
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-white border border-sand-300 rounded-lg px-3 py-2.5 text-sm focus:border-slateblue-500 focus:ring-2 focus:ring-slateblue-500/20 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveKey();
                    if (e.key === 'Escape') handleCloseModal();
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button onClick={handleSaveKey} loading={savingKey} disabled={!tempKey.trim()}>
                  Add Key
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
