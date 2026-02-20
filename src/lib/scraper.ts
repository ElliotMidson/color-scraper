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
    // Serverless: use @sparticuz/chromium which ships a Lambda-compatible binary
    const chromium = (await import('@sparticuz/chromium')).default;
    browser = await puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    // Local dev: use the system Chrome or the one installed by puppeteer-core
    const executablePath =
      process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome';

    browser = await puppeteerCore.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    });
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
