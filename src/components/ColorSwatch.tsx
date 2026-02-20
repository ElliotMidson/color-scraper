import { ColorEntry } from '@/types/colors';

interface Props {
  entry: ColorEntry;
}

export function ColorSwatch({ entry }: Props) {
  const r = parseInt(entry.hex.slice(1, 3), 16);
  const g = parseInt(entry.hex.slice(3, 5), 16);
  const b = parseInt(entry.hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? '#000000' : '#FFFFFF';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div
        className="w-12 h-12 rounded-md flex-shrink-0 border border-gray-100"
        style={{ backgroundColor: entry.hex }}
        aria-label={`Color swatch: ${entry.hex}`}
        title={entry.hex}
      >
        <span
          className="w-full h-full flex items-center justify-center text-[10px] font-mono font-bold opacity-0 hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          {entry.hex}
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-gray-900">{entry.hex}</p>
        <p className="text-xs text-gray-500 truncate" title={entry.source}>{entry.source}</p>
        <p className="text-xs text-gray-400">{entry.property}</p>
      </div>
    </div>
  );
}
