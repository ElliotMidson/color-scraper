'use client';

import { useState } from 'react';
import { ColorExtractorForm } from '@/components/ColorExtractorForm';
import { ResultsDisplay } from '@/components/ResultsDisplay';
import { ColorExtractionResult } from '@/types/colors';

export default function HomePage() {
  const [results, setResults] = useState<ColorExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleResults(data: ColorExtractionResult) {
    setResults(data);
    setError(null);
  }

  function handleError(msg: string) {
    setError(msg);
    setResults(null);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <span className="text-sm font-semibold tracking-tight text-black">Color Scraper</span>
        <span className="text-xs text-gray-400">by Elliot Midson</span>
      </nav>

      {/* Hero */}
      <section className="dot-grid border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-6">
            Color Extraction Tool
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-black leading-tight mb-6">
            Extract any website's<br />color palette
          </h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto mb-10">
            Paste a URL and instantly get every color — buttons, backgrounds, containers, and text — extracted directly from computed CSS styles.
          </p>
          <ColorExtractorForm onResults={handleResults} onError={handleError} />
        </div>
      </section>

      {/* Results */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        {error && (
          <div className="mb-8 px-4 py-3 border border-red-200 bg-red-50 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        {results && <ResultsDisplay data={results} />}
      </section>
    </div>
  );
}
