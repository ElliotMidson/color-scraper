'use client';

import type { SemanticColorEntry } from '@/types/extraction';

interface Props {
  entry: SemanticColorEntry;
  label?: string;
  selected?: boolean;
  onToggle?: () => void;
  swatchSize?: number;
}

export function ColorSwatch({ entry, label, selected = true, onToggle, swatchSize = 44 }: Props) {
  const hex = entry.hex.toUpperCase();
  const displayLabel = (label ?? entry.role).toUpperCase();

  const inner = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '6px 8px',
        borderRadius: 8,
        opacity: selected ? 1 : 0.35,
        transition: 'opacity 0.15s',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: swatchSize,
          height: swatchSize,
          borderRadius: Math.round(swatchSize * 0.25),
          background: hex,
          border: '1px solid rgba(5,5,5,0.08)',
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'rgba(5,5,5,0.45)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayLabel}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'monospace',
            color: 'rgba(5,5,5,0.65)',
            lineHeight: 1.5,
          }}
        >
          {hex}
        </p>
      </div>
    </div>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={selected ? 'Click to exclude' : 'Click to include'}
        style={{
          display: 'block',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
          borderRadius: 8,
        }}
      >
        {inner}
      </button>
    );
  }

  return inner;
}
