import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Run, ExpertReview, Dataset, LLMModel, DEFAULT_MODELS } from '@/types';

interface XaseStore {
  tasks: Task[];
  runs: Run[];
  reviews: ExpertReview[];
  datasets: Dataset[];
  models: LLMModel[];
  apiKeys: Record<string, string>;
  
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  addRun: (run: Omit<Run, 'id' | 'createdAt'>) => string;
  updateRun: (id: string, updates: Partial<Run>) => void;
  
  addReview: (review: Omit<ExpertReview, 'id' | 'reviewedAt'>) => void;
  
  addDataset: (dataset: Omit<Dataset, 'id' | 'createdAt'>) => void;
  
  setModelEnabled: (modelId: string, enabled: boolean) => void;
  setApiKey: (provider: string, key: string) => void;
  getApiKey: (provider: string) => string | undefined;
}

export const useStore = create<XaseStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      runs: [],
      reviews: [],
      datasets: [],
      models: DEFAULT_MODELS,
      apiKeys: {},
      
      addTask: (task) => {
        const newTask: Task = {
          ...task,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        return newTask.id;
      },
      
      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },
      
      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
      },
      
      addRun: (run) => {
        const newRun: Run = {
          ...run,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ runs: [...state.runs, newRun] }));
        return newRun.id;
      },
      
      updateRun: (id, updates) => {
        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },
      
      addReview: (review) => {
        const newReview: ExpertReview = {
          ...review,
          id: crypto.randomUUID(),
          reviewedAt: new Date().toISOString(),
        };
        set((state) => ({ reviews: [...state.reviews, newReview] }));
        return newReview.id;
      },
      
      addDataset: (dataset) => {
        const newDataset: Dataset = {
          ...dataset,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ datasets: [...state.datasets, newDataset] }));
        return newDataset.id;
      },
      
      setModelEnabled: (modelId, enabled) => {
        set((state) => ({
          models: state.models.map((m) =>
            m.id === modelId ? { ...m, enabled } : m
          ),
        }));
      },
      
      setApiKey: (provider, key) => {
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        }));
      },
      
      getApiKey: (provider) => {
        return get().apiKeys[provider];
      },
    }),
    {
      name: 'xase-storage',
    }
  )
);
