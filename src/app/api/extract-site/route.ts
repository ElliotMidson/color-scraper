import { NextRequest, NextResponse } from 'next/server';
import { extractSite } from '@/lib/scraper';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let url: string;
  let additionalImageryUrls: string[] = [];

  try {
    const body = await request.json();
    url = body.url?.trim();
    const raw = body.additionalImageryUrls;
    if (Array.isArray(raw)) {
      additionalImageryUrls = raw
        .filter((x: unknown): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean);
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const seenExtra = new Set<string>();
  const validatedExtras: string[] = [];
  for (const line of additionalImageryUrls) {
    if (seenExtra.has(line)) continue;
    seenExtra.add(line);
    try {
      const p = new URL(line);
      if (!['http:', 'https:'].includes(p.protocol)) continue;
      validatedExtras.push(line);
    } catch {
      /* skip invalid */
    }
  }
  const cappedExtras = validatedExtras.slice(0, 10);

  try {
    const result = await extractSite(url, { additionalImageryUrls: cappedExtras });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown scraping error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[extract-site] Error:', message);
    console.error('[extract-site] Stack:', stack);
    return NextResponse.json({ error: message, stack, url }, { status: 500 });
  }
}
