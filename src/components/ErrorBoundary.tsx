'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-full min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-warmgray-700 mb-2">Something went wrong</h2>
            <p className="text-sm text-warmgray-500 mb-4">{this.state.error?.message ?? 'An unexpected error occurred.'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 rounded-lg bg-slateblue-700 text-white text-sm hover:bg-slateblue-800 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
