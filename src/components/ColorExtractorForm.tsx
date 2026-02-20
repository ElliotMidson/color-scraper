'use client';

import { useState, FormEvent } from 'react';
import { ColorExtractionResult } from '@/types/colors';

interface Props {
  onResults: (data: ColorExtractionResult) => void;
  onError: (msg: string) => void;
}

export function ColorExtractorForm({ onResults, onError }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://www.${trimmed.replace(/^www\./i, '')}`;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const normalizedUrl = normalizeUrl(url);
    try {
      const res = await fetch('/api/extract-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      onResults(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl mx-auto">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="stripe.com"
        required
        disabled={loading}
        className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm text-black placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-50 transition"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-3 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-900 disabled:opacity-50 transition whitespace-nowrap"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Scanning...
          </span>
        ) : (
          'Extract Colors'
        )}
      </button>
    </form>
  );
}
