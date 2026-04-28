'use client';

import { useEffect } from 'react';
import { X } from '@phosphor-icons/react';

type Props = {
  src: string | null;
  title?: string;
  onClose: () => void;
};

export function ImagePreviewModal({ src, title, onClose }: Props) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Image preview'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        background: 'rgba(0,0,0,0.72)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: 'min(96vw, 1200px)',
          maxHeight: 'min(90vh, 900px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ch-btn-ghost"
          aria-label="Close preview"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-var(--space-2)',
            right: '-var(--space-2)',
            zIndex: 2,
            background: 'var(--color-surface-primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2)',
            boxShadow: '0 1px 8px rgba(0,0,0,0.2)',
          }}
        >
          <X size={20} weight="bold" aria-hidden />
        </button>
        <div
          style={{
            maxWidth: '100%',
            maxHeight: 'min(85vh, 820px)',
            overflow: 'auto',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-surface-primary)',
            padding: 'var(--space-3)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: 'min(80vh, 780px)',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>
      </div>
    </div>
  );
}
