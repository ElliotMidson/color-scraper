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
    <div className="w-full max-w-4xl space-y-8">
      <div className="flex items-center justify-between text-sm text-gray-500 border-b border-gray-200 pb-4">
        <div>
          Scraped <span className="font-mono text-gray-700">{data.url}</span>
        </div>
        <div>
          {totalColors} unique colors &middot; {new Date(data.scrapedAt).toLocaleTimeString()}
        </div>
      </div>

      {CATEGORIES.map(({ key, label, description }) => {
        const entries = data[key];
        if (entries.length === 0) return null;
        return (
          <section key={key}>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-800">
                {label}
                <span className="ml-2 text-sm font-normal text-gray-400">({entries.length})</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {entries.map((entry, i) => (
                <ColorSwatch key={`${entry.hex}-${i}`} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}

      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 select-none">
          View raw JSON
        </summary>
        <pre className="mt-3 p-4 bg-gray-50 rounded-lg text-xs overflow-auto max-h-96 border border-gray-200 text-gray-700">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
