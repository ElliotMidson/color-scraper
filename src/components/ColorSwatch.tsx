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
    <div className="group border border-gray-100 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
      {/* Swatch block */}
      <div
        className="w-full h-20 relative"
        style={{ backgroundColor: entry.hex }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-mono font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          {entry.hex}
        </span>
      </div>
      {/* Meta */}
      <div className="px-3 py-2.5">
        <p className="font-mono text-xs font-semibold text-black tracking-tight">{entry.hex}</p>
        <p className="text-[11px] text-gray-400 truncate mt-0.5" title={entry.source}>{entry.source}</p>
      </div>
    </div>
  );
}
