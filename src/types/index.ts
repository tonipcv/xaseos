export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'grok' | 'groq' | 'ollama';

export interface LLMModel {
  id: string;
  name: string;
  provider: ModelProvider;
  enabled: boolean;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string;
  userPrompt: string;
  models: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ModelResponse {
  modelId: string;
  modelName: string;
  provider: string;
  content: string;
  latencyMs: number;
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  error?: string;
  cached?: boolean;
}

export interface Run {
  id: string;
  taskId: string;
  taskName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  responses: ModelResponse[];
  createdAt: string;
  completedAt?: string;
  costEstimate?: number;
}

export type ReviewLabel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'failure';

export interface ExpertReview {
  id: string;
  runId: string;
  modelResponseId: string;
  label: ReviewLabel;
  score: number;
  rationale: string;
  correctedOutput?: string;
  reviewedAt: string;
  reviewer?: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  runs: string[];
  reviews: string[];
  createdAt: string;
  exportFormat: 'jsonl' | 'csv' | 'huggingface';
}

export const DEFAULT_MODELS: LLMModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', enabled: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', enabled: true },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', enabled: true },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', enabled: false },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', enabled: true },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', enabled: true },
  { id: 'grok-beta', name: 'Grok Beta', provider: 'grok', enabled: true },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', enabled: true },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', enabled: false },
  { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', enabled: false },
  { id: 'llama3.1', name: 'Llama 3.1', provider: 'ollama', enabled: false },
  { id: 'mistral', name: 'Mistral', provider: 'ollama', enabled: false },
  { id: 'qwen2.5', name: 'Qwen 2.5', provider: 'ollama', enabled: false },
];

export const REVIEW_LABELS: { value: ReviewLabel; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'bg-slateblue-500' },
  { value: 'good', label: 'Good', color: 'bg-blue-500' },
  { value: 'acceptable', label: 'Acceptable', color: 'bg-yellow-500' },
  { value: 'poor', label: 'Poor', color: 'bg-orange-500' },
  { value: 'failure', label: 'Failure', color: 'bg-red-500' },
];
