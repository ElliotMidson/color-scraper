import { NextRequest, NextResponse } from 'next/server';
import { analyzeBrandFromPageText, isBrandAiConfigured } from '@/lib/brandAi';
import { extractReadablePageText } from '@/lib/scraper';
import type { BrandAnalysisApiResponse } from '@/types/extraction';

export const maxDuration = 120;

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

  if (!isBrandAiConfigured()) {
    return NextResponse.json(
      {
        error:
          'No AI key configured. Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY (or CLAUDE_API_KEY) in .env.local — see .env.example — then restart the dev server.',
      },
      { status: 503 }
    );
  }

  try {
    const { url: finalUrl, text } = await extractReadablePageText(url);
    const { brand, model } = await analyzeBrandFromPageText(finalUrl, text);

    const payload: BrandAnalysisApiResponse = {
      brand,
      analyzedUrl: finalUrl,
      textCharsUsed: text.length,
      model,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[analyze-brand]', message);
    return NextResponse.json({ error: message, url }, { status: 500 });
  }
}
