'use client';

import { ColorExtractionResult } from '@/types/colors';
import { ColorSwatch } from './ColorSwatch';

const CATEGORIES: {
  key: keyof Omit<ColorExtractionResult, 'url' | 'scrapedAt'>;
  label: string;
  description: string;
}[] = [
  { key: 'primaryButtons', label: 'Primary Buttons', description: 'Background colors from button and anchor elements' },
  { key: 'elementBackgrounds', label: 'Element Backgrounds', description: 'Background colors from large containers, sections, and cards' },
  { key: 'pageBackgrounds', label: 'Page Backgrounds', description: 'Background colors from top-level structural elements' },
  { key: 'textColors', label: 'Dominant Text Color', description: 'Most frequently used text color on the page' },
  { key: 'cssVariables', label: 'CSS Variables', description: 'Design token color variables (--color-*, --brand-*, etc.)' },
];

interface Props {
  data: ColorExtractionResult;
}

export function ResultsDisplay({ data }: Props) {
  const totalColors = CATEGORIES.reduce((sum, c) => sum + data[c.key].length, 0);

  return (
    <div className="w-full space-y-12">

      {/* Summary bar */}
      <div className="flex items-center justify-between pb-5 border-b border-gray-100">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-1">Results</p>
          <p className="text-sm font-medium text-black truncate max-w-sm">{data.url}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-black">{totalColors}</p>
          <p className="text-xs text-gray-400">colors found</p>
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map(({ key, label, description }) => {
        const entries = data[key];
        if (entries.length === 0) return null;
        return (
          <section key={key}>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-black tracking-tight">{label}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </div>
              <span className="text-xs font-mono text-gray-400 ml-4 shrink-0">{entries.length}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {entries.map((entry, i) => (
                <ColorSwatch key={`${entry.hex}-${i}`} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Raw JSON */}
      <details className="border border-gray-100 rounded-xl overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-gray-500 hover:text-black hover:bg-gray-50 transition select-none">
          View raw JSON
        </summary>
        <pre className="px-4 py-4 bg-gray-50 text-xs overflow-auto max-h-96 text-gray-600 border-t border-gray-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
