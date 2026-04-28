import type { SemanticColorEntry } from '@/types/extraction';

interface Props {
  entry: SemanticColorEntry;
  selected?: boolean;
  onToggle?: () => void;
}

export function ColorSwatch({ entry, selected = true, onToggle }: Props) {
  const r = parseInt(entry.hex.slice(1, 3), 16);
  const g = parseInt(entry.hex.slice(3, 5), 16);
  const b = parseInt(entry.hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const overlayHex = luminance > 0.5 ? '#000000' : '#ffffff';

  const body = (
    <>
      <div
        className="w-full h-20 relative"
        style={{ backgroundColor: entry.hex }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity ch-type-system-text-xs"
          style={{ color: overlayHex }}
        >
          {entry.hex}
        </span>
      </div>
      <div style={{ padding: 'var(--space-3)' }}>
        <p
          className="font-mono text-xs font-semibold tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {entry.hex}
        </p>
        <p className="ch-type-system-label-xs" style={{ marginTop: 'var(--space-1)' }}>
          {entry.role}
        </p>
        <p
          className="ch-type-system-text-xs truncate"
          style={{ marginTop: 'var(--space-1)' }}
          title={entry.source}
        >
          {entry.property} · {entry.source}
        </p>
      </div>
    </>
  );

  if (onToggle) {
    return (
      <div
        className="group ch-swatch-selectable-wrap"
        data-selected={selected ? 'true' : 'false'}
      >
        <button type="button" className="ch-swatch-selectable-hit" onClick={onToggle}>
          {body}
        </button>
        <div
          style={{
            padding: '0 var(--space-3) var(--space-3)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              padding: 'var(--space-1)',
            }}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label="Include in style guide"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="group ch-card-selectable" data-selected="true">
      {body}
    </div>
  );
}
