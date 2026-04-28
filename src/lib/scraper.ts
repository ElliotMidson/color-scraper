import { existsSync } from 'fs';
import puppeteerCore, { Browser } from 'puppeteer-core';
import { extractSiteDesignTokens } from './domInspector';
import { normalizeColor, isColorMeaningful } from './colorUtils';
import { buildFontEntries } from './fontClassifier';
import { embedFontsForEntries } from './fontEmbed';
import { generateThumbnails } from './thumbnails';
import type {
  ImageryEntry,
  LogoOrMarkEntry,
  SemanticColorEntry,
  SiteExtractionResult,
} from '@/types/extraction';

let browser: Browser | null = null;

const LOCAL_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
];

/**
 * Puppeteer v24+ does not always ship Chrome in the expected cache (e.g. Cursor sandbox).
 * Prefer a real browser: env override, then well-known install paths, then full `puppeteer` fallback.
 */
function resolveLocalChromeExecutable(): string | undefined {
  const fromEnv =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || process.env.CHROME_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates: string[] = [];
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
    );
  } else if (process.platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  } else if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );
  }

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    const chromium = (await import('@sparticuz/chromium-min')).default;
    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'
    );
    browser = await puppeteerCore.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  } else {
    const chromePath = resolveLocalChromeExecutable();
    if (chromePath) {
      browser = await puppeteerCore.launch({
        headless: true,
        executablePath: chromePath,
        args: LOCAL_LAUNCH_ARGS,
      });
    } else {
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({
        headless: true,
        args: LOCAL_LAUNCH_ARGS,
      }) as unknown as Browser;
    }
  }

  return browser;
}

process.on('exit', () => {
  browser?.close();
});

function dedupeSemanticColors(entries: SemanticColorEntry[]): SemanticColorEntry[] {
  const map = new Map<string, SemanticColorEntry>();
  for (const e of entries) {
    const key = `${e.role}|${e.hex}|${e.property}`;
    if (!map.has(key)) map.set(key, e);
  }
  return Array.from(map.values());
}

function processSemanticRaw(
  raw: { role: string; selector: string; property: string; value: string }[]
): SemanticColorEntry[] {
  const out: SemanticColorEntry[] = [];
  const validRoles = new Set([
    'pageBackground',
    'sectionBackground',
    'card',
    'heading',
    'subheading',
    'body',
    'link',
    'headerCta',
    'button',
    'border',
  ]);

  for (const entry of raw) {
    if (!validRoles.has(entry.role)) continue;
    const hex = normalizeColor(entry.value) ?? '';
    if (!isColorMeaningful(hex)) continue;
    out.push({
      role: entry.role as SemanticColorEntry['role'],
      hex,
      source: entry.selector,
      property: entry.property,
    });
  }
  return dedupeSemanticColors(out);
}

function dedupeImagery(items: ImageryEntry[]): ImageryEntry[] {
  const seen = new Set<string>();
  const out: ImageryEntry[] = [];
  for (const i of items) {
    if (seen.has(i.url)) continue;
    seen.add(i.url);
    out.push(i);
  }
  return out;
}

function dedupeLogos(items: LogoOrMarkEntry[]): LogoOrMarkEntry[] {
  const seen = new Set<string>();
  const out: LogoOrMarkEntry[] = [];
  for (const l of items) {
    const key = `${l.kind}|${l.url ?? ''}|${l.selectorHint}|${l.inlineSvgPreview?.slice(0, 40) ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

function resolvePageUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

/** Visible text for LLM prompts; separate navigation from design scrape to keep audits cheap. */
export async function extractReadablePageText(
  pageUrl: string,
  maxChars = 14_000
): Promise<{ url: string; text: string }> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    await new Promise((r) => setTimeout(r, 1000));

    const rawText = await page.evaluate(() => {
      const roots: Element[] = [];
      for (const sel of ['main', 'article', '[role="main"]']) {
        document.querySelectorAll(sel).forEach((el) => roots.push(el));
      }
      if (roots.length === 0) {
        const b = document.body;
        if (b) roots.push(b);
      }

      const chunks: string[] = [];
      const seen = new Set<Element>();

      function textFrom(el: Element): string {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, noscript, svg, iframe, template').forEach((n) => n.remove());
        const t = clone.innerText || '';
        return t.replace(/\s+/g, ' ').trim();
      }

      for (const el of roots) {
        if (seen.has(el)) continue;
        seen.add(el);
        const t = textFrom(el);
        if (t.length > 80) chunks.push(t);
      }

      if (chunks.length === 0 && document.body) {
        const t = textFrom(document.body);
        if (t) chunks.push(t);
      }

      const title = document.title?.trim();
      const h1 = document.querySelector('h1')?.textContent?.trim();
      const head = [title, h1].filter(Boolean).join(' — ');
      const body = chunks.join('\n\n');
      return head ? `${head}\n\n${body}` : body;
    });

    const finalUrl = page.url();
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, maxChars);
    return { url: finalUrl, text };
  } finally {
    await page.close();
  }
}

type RawDesignTokens = Awaited<ReturnType<typeof extractSiteDesignTokens>>;

async function scrapeDesignTokensPage(pageUrl: string): Promise<{
  raw: RawDesignTokens;
  finalUrl: string;
}> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    await new Promise((r) => setTimeout(r, 1200));

    const raw = await page.evaluate(extractSiteDesignTokens);
    const finalUrl = page.url();
    return { raw, finalUrl };
  } finally {
    await page.close();
  }
}

export type ExtractSiteOptions = {
  /** Extra pages visited only to merge imagery (same design-token pass; logos/fonts/colors stay primary). */
  additionalImageryUrls?: string[];
};

export async function extractSite(
  pageUrl: string,
  options?: ExtractSiteOptions
): Promise<SiteExtractionResult> {
  const { raw, finalUrl } = await scrapeDesignTokensPage(pageUrl);

  const semanticColors = processSemanticRaw(raw.semanticColors);

  let imagery: ImageryEntry[] = dedupeImagery(
    raw.imagery.map((i) => ({
      url: resolvePageUrl(i.url, finalUrl),
      role: i.role as ImageryEntry['role'],
      alt: i.alt,
      width: i.width,
      height: i.height,
    }))
  );

  const logosAndMarks: LogoOrMarkEntry[] = dedupeLogos(
    raw.logosAndMarks.map((l) => ({
      url: l.url ? resolvePageUrl(l.url, finalUrl) : undefined,
      kind: l.kind as LogoOrMarkEntry['kind'],
      role: l.role as LogoOrMarkEntry['role'],
      selectorHint: l.selectorHint,
      alt: l.alt,
      inlineSvgPreview: l.inlineSvgPreview,
    }))
  );

  const logoAssetUrls = new Set(
    logosAndMarks.map((l) => l.url).filter((u): u is string => typeof u === 'string' && u.length > 0)
  );
  imagery = imagery.filter((im) => !logoAssetUrls.has(im.url));

  const extras = (options?.additionalImageryUrls ?? [])
    .map((u) => u.trim())
    .filter((line) => line.length > 0);

  for (const extraUrl of extras) {
    let parsed: URL;
    try {
      parsed = new URL(extraUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
    } catch {
      continue;
    }
    try {
      const { raw: r2, finalUrl: f2 } = await scrapeDesignTokensPage(parsed.href);
      const batch = dedupeImagery(
        r2.imagery.map((i) => ({
          url: resolvePageUrl(i.url, f2),
          role: i.role as ImageryEntry['role'],
          alt: i.alt,
          width: i.width,
          height: i.height,
        }))
      );
      for (const im of batch) {
        if (logoAssetUrls.has(im.url)) continue;
        if (!imagery.some((e) => e.url === im.url)) imagery.push(im);
      }
    } catch (err) {
      console.warn('[extract-site] additional imagery URL skipped:', extraUrl, err);
    }
  }

  imagery = dedupeImagery(imagery);

  const fonts = await embedFontsForEntries(
    buildFontEntries(
      raw.fontStacks,
      raw.fontFaceRules,
      raw.stylesheetHrefs.map((h) => resolvePageUrl(h, finalUrl))
    ),
    raw.fontFaceRules,
    finalUrl,
    resolvePageUrl
  );

  const thumbnails = await generateThumbnails(imagery, logosAndMarks, finalUrl);

  return {
    semanticColors,
    logosAndMarks,
    fonts,
    imagery,
    thumbnails,
    url: finalUrl,
    scrapedAt: new Date().toISOString(),
  };
}
