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
    <main className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Color Extractor</h1>
          <p className="text-gray-500 text-sm">
            Enter any URL to extract its color palette from computed CSS styles — buttons, backgrounds, containers, and text.
          </p>
        </header>

        <div className="flex justify-center">
          <ColorExtractorForm onResults={handleResults} onError={handleError} />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-2xl mx-auto">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        {results && <ResultsDisplay data={results} />}
      </div>
    </main>
  );
}
