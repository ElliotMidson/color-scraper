import type { BrandAnalysisResult } from '@/types/extraction';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-20241022';

function anthropicApiKey(override?: string): string | undefined {
  return (
    override?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim() ||
    undefined
  );
}

type Provider = 'openai' | 'anthropic';

type KeyOverrides = { anthropicApiKey?: string };

function resolveProvider(overrides?: KeyOverrides): Provider {
  const explicit = process.env.BRAND_AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'claude') {
    if (!anthropicApiKey(overrides?.anthropicApiKey)) {
      throw new Error(
        'BRAND_AI_PROVIDER requests Claude but ANTHROPIC_API_KEY (or CLAUDE_API_KEY) is not set'
      );
    }
    return 'anthropic';
  }
  if (explicit === 'openai') {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error('BRAND_AI_PROVIDER=openai but OPENAI_API_KEY is not set');
    }
    return 'openai';
  }
  if (overrides?.anthropicApiKey?.trim()) return 'anthropic';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  if (anthropicApiKey()) return 'anthropic';
  throw new Error('No AI provider configured');
}

function parseBrandJson(raw: unknown): BrandAnalysisResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid model output: not an object');
  }
  const o = raw as Record<string, unknown>;
  const toneOfVoice = typeof o.toneOfVoice === 'string' ? o.toneOfVoice : '';
  const whatTheyDo = typeof o.whatTheyDo === 'string' ? o.whatTheyDo : '';
  const pricingSummary = typeof o.pricingSummary === 'string' ? o.pricingSummary : '';

  let keyFeaturesOrServices: string[] = [];
  if (Array.isArray(o.keyFeaturesOrServices)) {
    keyFeaturesOrServices = o.keyFeaturesOrServices.filter((x): x is string => typeof x === 'string');
  } else if (typeof o.keyFeaturesOrServices === 'string') {
    keyFeaturesOrServices = [o.keyFeaturesOrServices];
  }

  if (!toneOfVoice && !whatTheyDo && keyFeaturesOrServices.length === 0 && !pricingSummary) {
    throw new Error('Invalid model output: empty fields');
  }

  return {
    toneOfVoice: toneOfVoice || 'Not enough copy to infer tone.',
    whatTheyDo: whatTheyDo || 'Could not determine from the provided text.',
    keyFeaturesOrServices:
      keyFeaturesOrServices.length > 0
        ? keyFeaturesOrServices.slice(0, 20)
        : ['No specific features called out in the excerpt.'],
    pricingSummary:
      pricingSummary || 'Not stated in the visible page text provided.',
  };
}

function buildPrompts(pageUrl: string, pageText: string): { system: string; user: string } {
  const system = `You are a brand strategist. Given visible text from a single web page (often the homepage), infer:
- toneOfVoice: 2–4 sentences on brand voice (formal/casual, playful/serious, technical/simple, inclusive, etc.). Ground claims in quoted patterns or vocabulary from the text when possible.
- whatTheyDo: 2–5 sentences: what company or product this is and who it is for.
- keyFeaturesOrServices: bullet-level strings (max 8) for main products, features, or services mentioned.
- pricingSummary: If pricing, plans, or free tier are mentioned, summarize briefly. If not present in the text, say clearly that pricing was not found on this page (do not invent numbers).

Respond with JSON only, no markdown fences, keys: toneOfVoice (string), whatTheyDo (string), keyFeaturesOrServices (string array), pricingSummary (string).`;

  const user = `Page URL: ${pageUrl}

Page text (may be truncated):
---
${pageText}
---`;

  return { system, user };
}

function parseJsonFromModelText(content: string): unknown {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

async function analyzeWithOpenAI(
  pageUrl: string,
  pageText: string,
  _overrides?: KeyOverrides
): Promise<{ brand: BrandAnalysisResult; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const { system, user } = buildPrompts(pageUrl, pageText);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned no message content');
  }

  let parsed: unknown;
  try {
    parsed = parseJsonFromModelText(content);
  } catch {
    throw new Error('OpenAI returned non-JSON content');
  }

  return { brand: parseBrandJson(parsed), model };
}

async function analyzeWithAnthropic(
  pageUrl: string,
  pageText: string,
  overrides?: KeyOverrides
): Promise<{ brand: BrandAnalysisResult; model: string }> {
  const apiKey = anthropicApiKey(overrides?.anthropicApiKey)!;
  const model =
    process.env.ANTHROPIC_MODEL?.trim() ||
    process.env.CLAUDE_MODEL?.trim() ||
    DEFAULT_ANTHROPIC_MODEL;
  const { system, user } = buildPrompts(pageUrl, pageText);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const textBlocks = (data.content ?? []).filter((b) => b.type === 'text');
  const content = textBlocks.map((b) => b.text ?? '').join('');
  if (!content.trim()) {
    throw new Error('Anthropic returned no text content');
  }

  let parsed: unknown;
  try {
    parsed = parseJsonFromModelText(content);
  } catch {
    throw new Error('Anthropic returned non-JSON content');
  }

  return { brand: parseBrandJson(parsed), model };
}

export function isBrandAiConfigured(overrides?: KeyOverrides): boolean {
  return !!(
    overrides?.anthropicApiKey?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    anthropicApiKey()
  );
}

/**
 * Brand analysis via OpenAI or Anthropic (Claude). See resolve rules in README / .env.example.
 */
export async function analyzeBrandFromPageText(
  pageUrl: string,
  pageText: string,
  overrides?: KeyOverrides
): Promise<{ brand: BrandAnalysisResult; model: string }> {
  if (!pageText.trim()) {
    throw new Error('No readable text was extracted from the page');
  }

  const provider = resolveProvider(overrides);
  if (provider === 'openai') {
    return analyzeWithOpenAI(pageUrl, pageText, overrides);
  }
  return analyzeWithAnthropic(pageUrl, pageText, overrides);
}
