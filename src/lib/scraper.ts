import puppeteerCore, { Browser } from 'puppeteer-core';
import { extractColorsFromDOM } from './domInspector';
import {
  normalizeColor,
  isColorMeaningful,
  deduplicateColors,
} from './colorUtils';
import { ColorEntry, ColorExtractionResult } from '@/types/colors';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    // Serverless: use @sparticuz/chromium-min which fetches the binary at runtime
    // to avoid the "bin directory does not exist" build error from the full package
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
    // Local dev: use full puppeteer which bundles its own Chromium
    const puppeteer = (await import('puppeteer')).default;
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    }) as unknown as Browser;
  }

  return browser;
}

process.on('exit', () => {
  browser?.close();
});

function processRawEntries(
  raw: { selector: string; property: string; value: string }[]
): ColorEntry[] {
  return raw
    .map((entry) => ({
      hex: normalizeColor(entry.value) ?? '',
      source: entry.selector,
      property: entry.property,
    }))
    .filter((e) => isColorMeaningful(e.hex));
}

export async function extractColors(url: string): Promise<ColorExtractionResult> {
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

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Brief pause for CSS-in-JS frameworks to apply styles
    await new Promise((r) => setTimeout(r, 1000));

    const rawData = await page.evaluate(extractColorsFromDOM);

    return {
      primaryButtons: deduplicateColors(processRawEntries(rawData.primaryButtons)),
      elementBackgrounds: deduplicateColors(processRawEntries(rawData.elementBackgrounds)),
      pageBackgrounds: deduplicateColors(processRawEntries(rawData.pageBackgrounds)),
      textColors: deduplicateColors(processRawEntries(rawData.textColors)),
      cssVariables: deduplicateColors(processRawEntries(rawData.cssVariables)),
      url,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    await page.close();
  }
}
