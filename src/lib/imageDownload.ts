/**
 * Client-side image download: tries fetch→blob (respects CORS), then falls back to direct link.
 */
export function suggestedFilenameFromUrl(url: string, idHint: string): string {
  if (url.startsWith('data:image/svg+xml')) return `${sanitizeHint(idHint)}.svg`;
  if (url.startsWith('data:image/')) {
    const m = /^data:image\/(\w+)/i.exec(url);
    const ext = m?.[1] === 'jpeg' ? 'jpg' : m?.[1] || 'img';
    return `${sanitizeHint(idHint)}.${ext}`;
  }
  if (url.startsWith('data:')) return `${sanitizeHint(idHint)}.bin`;
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last && /\.(jpe?g|png|gif|webp|avif|svg|ico|bmp)(\?|$)/i.test(last)) {
      return last.split('?')[0].slice(0, 120);
    }
  } catch {
    /* ignore */
  }
  return `${sanitizeHint(idHint)}.jpg`;
}

function sanitizeHint(h: string): string {
  return h.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '') || 'image';
}

function clickDownloadLink(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadImageFromUrl(url: string, idHint: string): Promise<void> {
  const filename = suggestedFilenameFromUrl(url, idHint);

  if (url.startsWith('data:')) {
    clickDownloadLink(url, filename);
    return;
  }

  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    let name = filename;
    if (!/\.[a-z0-9]{2,4}$/i.test(name)) {
      const t = blob.type;
      if (t.includes('svg')) name += '.svg';
      else if (t.includes('png')) name += '.png';
      else if (t.includes('webp')) name += '.webp';
      else if (t.includes('gif')) name += '.gif';
      else name += '.jpg';
    }
    const obj = URL.createObjectURL(blob);
    clickDownloadLink(obj, name);
    URL.revokeObjectURL(obj);
  } catch {
    clickDownloadLink(url, filename);
  }
}
