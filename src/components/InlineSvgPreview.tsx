'use client';

import { useMemo, useState } from 'react';

interface Props {
  svgMarkup: string;
  /** Max height of the rasterized preview box */
  maxHeight?: number;
  /** When set, constrains width (style guide logo tile, etc.) */
  maxWidth?: number;
  className?: string;
}

/**
 * Renders inline SVG markup as a preview using a data URL on `<img>` (SVG scripts do not run in this context).
 */
export function InlineSvgPreview({ svgMarkup, maxHeight = 96, maxWidth, className }: Props) {
  const [broken, setBroken] = useState(false);

  const dataUrl = useMemo(() => {
    const t = svgMarkup.trim();
    if (!t || !/<svg[\s/>]/i.test(t)) return null;
    try {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`;
    } catch {
      return null;
    }
  }, [svgMarkup]);

  if (!dataUrl || broken) {
    return (
      <pre
        className={className}
        style={{
          margin: 0,
          maxHeight: `${maxHeight * 2}px`,
          overflow: 'auto',
          fontSize: '10px',
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2)',
        }}
      >
        {svgMarkup.slice(0, 600)}
        {svgMarkup.length > 600 ? '…' : ''}
      </pre>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt=""
      role="presentation"
      className={className}
      onError={() => setBroken(true)}
      style={{
        display: 'block',
        maxHeight,
        maxWidth: maxWidth !== undefined ? `min(100%, ${maxWidth}px)` : '100%',
        width: maxWidth !== undefined ? maxWidth : 'auto',
        height: 'auto',
        objectFit: 'contain',
      }}
    />
  );
}
