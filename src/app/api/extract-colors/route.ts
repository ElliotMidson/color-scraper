import { NextRequest, NextResponse } from 'next/server';
import { extractColors } from '@/lib/scraper';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let url: string;

  try {
    const body = await request.json();
    url = body.url?.trim();
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

  try {
    const result = await extractColors(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown scraping error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[extract-colors] Error:', message);
    console.error('[extract-colors] Stack:', stack);
    return NextResponse.json({ error: message, stack, url }, { status: 500 });
  }
}
