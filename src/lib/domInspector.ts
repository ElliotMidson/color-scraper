// Runs inside Chromium via page.evaluate(). Self-contained — no imports or closures.

export function extractSiteDesignTokens() {
  type RawColor = { role: string; selector: string; property: string; value: string };
  type RawFontStack = { stack: string; sampleSelector: string };
  type RawFontFace = { family: string; srcUrls: string[] };
  type RawImagery = { url: string; role: string; alt?: string; width?: number; height?: number };
  type RawLogo = {
    url?: string;
    kind: string;
    role: string;
    selectorHint: string;
    alt?: string;
    inlineSvgPreview?: string;
  };

  const MAX_SEMANTIC_SAMPLES = 25;
  const MAX_BG_SCAN = 120;
  const MAX_IMAGERY = 220;
  /** Max raster URLs to record per element for layered / image-set backgrounds. */
  const MAX_BG_URLS_PER_EL = 8;
  /** Capped for JSON size; truncation may clip closing tags — client preview falls back on error. */
  const MAX_INLINE_SVG = 12000;
  const MAX_LOGOS = 40;

  const semanticColors: RawColor[] = [];
  const fontStacks: RawFontStack[] = [];
  const fontFaceRules: RawFontFace[] = [];
  const stylesheetHrefs: string[] = [];
  const imagery: RawImagery[] = [];
  const logosAndMarks: RawLogo[] = [];
  const seenUrls = new Set<string>();

  function getStyle(el: Element, prop: string): string {
    return window.getComputedStyle(el).getPropertyValue(prop).trim();
  }

  function describeElement(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls =
      el.classList.length > 0
        ? '.' + Array.from(el.classList).slice(0, 2).join('.')
        : '';
    return `${tag}${id}${cls}`.slice(0, 80);
  }

  function isVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0)
      return false;
    return rect.width >= 2 && rect.height >= 2;
  }

  function pushColor(role: string, el: Element, property: string) {
    const v = getStyle(el, property);
    if (!v || v === 'transparent' || v === 'none' || v === 'rgba(0, 0, 0, 0)') return;
    if (property === 'border-color' && (v === 'rgb(0, 0, 0)' || v === 'rgba(0, 0, 0, 0)'))
      return;
    semanticColors.push({
      role,
      selector: describeElement(el),
      property,
      value: v,
    });
  }

  /** Pull solid color tokens from linear/radial/conic gradients (and repeats) for the palette. */
  function extractGradientColorTokens(css: string): string[] {
    if (!css || !/gradient/i.test(css)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (t: string) => {
      const raw = t.trim();
      const key = raw.toLowerCase();
      if (!key || key === 'transparent' || key === 'none' || key === 'currentcolor') return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(raw);
    };
    let m: RegExpExecArray | null;
    const reHex = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
    while ((m = reHex.exec(css)) !== null) add(m[0]);
    const reRgb = /\brgba?\([^)]*\)/gi;
    while ((m = reRgb.exec(css)) !== null) add(m[0]);
    const reHsl = /\bhsla?\([^)]*\)/gi;
    while ((m = reHsl.exec(css)) !== null) add(m[0]);
    const reLab = /\b(?:oklab|oklch|lch|lab)\([^)]*\)/gi;
    while ((m = reLab.exec(css)) !== null) add(m[0]);
    return out;
  }

  /** Sample flat background-color plus color stops from background-image gradients. */
  function pushSurfaceColors(role: string, el: Element) {
    pushColor(role, el, 'background-color');
    const bi = getStyle(el, 'background-image');
    if (!bi || bi === 'none') return;
    const stops = extractGradientColorTokens(bi);
    stops.forEach((val, i) => {
      semanticColors.push({
        role,
        selector: describeElement(el),
        property: `background-image (gradient stop ${i + 1})`,
        value: val,
      });
    });
  }

  function pushTextGradientColors(role: string, el: Element) {
    const bi = getStyle(el, 'background-image');
    if (!bi || !/gradient/i.test(bi)) return;
    const stops = extractGradientColorTokens(bi);
    stops.forEach((val, i) => {
      semanticColors.push({
        role,
        selector: describeElement(el),
        property: `background-image (text gradient ${i + 1})`,
        value: val,
      });
    });
  }

  function sampleElements(selector: string, max: number): Element[] {
    return Array.from(document.querySelectorAll(selector)).filter(isVisible).slice(0, max);
  }

  function pushFontStack(el: Element) {
    const stack = getStyle(el, 'font-family');
    if (!stack) return;
    fontStacks.push({ stack, sampleSelector: describeElement(el) });
  }

  // --- Semantic colors: page / section backgrounds ---
  const pageBgSelectors = ['html', 'body', 'main', 'header', 'footer', '#root', '#__next', '#app'];
  pageBgSelectors.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el || !isVisible(el)) return;
    pushSurfaceColors('pageBackground', el);
  });

  const sectionSelectors =
    'section, [class*="section"], [class*="hero"], [class*="banner"], article';
  sampleElements(sectionSelectors, MAX_SEMANTIC_SAMPLES).forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 120 && rect.height > 80) pushSurfaceColors('sectionBackground', el);
  });

  // Cards / panels
  sampleElements(
    '[class*="card"], [class*="panel"], article[class], [class*="tile"]',
    MAX_SEMANTIC_SAMPLES
  ).forEach((el) => {
    pushSurfaceColors('card', el);
    pushColor('card', el, 'color');
    pushColor('card', el, 'border-color');
  });

  // Headings / subheadings / body
  sampleElements('h1, h2', 15).forEach((el) => {
    pushColor('heading', el, 'color');
    pushTextGradientColors('heading', el);
    pushFontStack(el);
  });
  sampleElements('h3, h4', 15).forEach((el) => {
    pushColor('subheading', el, 'color');
    pushTextGradientColors('subheading', el);
    pushFontStack(el);
  });
  sampleElements('p, li', MAX_SEMANTIC_SAMPLES).forEach((el) => {
    pushColor('body', el, 'color');
    pushFontStack(el);
  });

  // Links
  sampleElements('main a, article a, [role="main"] a', 20).forEach((el) => {
    pushColor('link', el, 'color');
  });

  // Buttons
  const buttonSel =
    'button, [type="submit"], [role="button"], a.btn, a.button, header a[class*="button"]';
  sampleElements(buttonSel, 25).forEach((el) => {
    pushSurfaceColors('button', el);
    pushColor('button', el, 'color');
    pushColor('button', el, 'border-color');
    pushFontStack(el);
  });

  // Borders on large containers
  Array.from(
    document.querySelectorAll(
      'div, section, article, header, footer, nav, main, aside, [class*="card"]'
    )
  )
    .filter(isVisible)
    .slice(0, 60)
    .forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 80 && rect.height > 40) pushColor('border', el, 'border-color');
    });

  // --- Stylesheet links (font CDNs) ---
  document.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
    const href = (link as HTMLLinkElement).href;
    if (href) stylesheetHrefs.push(href);
  });

  // --- @font-face from accessible stylesheets ---
  function extractUrlsFromSrc(src: string): string[] {
    const out: string[] = [];
    const re = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const u = m[1].trim();
      if (u && !u.startsWith('data:')) out.push(u);
    }
    return out;
  }

  try {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules).forEach((rule) => {
          if (rule instanceof CSSFontFaceRule) {
            const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
            const src = rule.style.getPropertyValue('src');
            const srcUrls = extractUrlsFromSrc(src);
            if (family && srcUrls.length) fontFaceRules.push({ family, srcUrls });
          }
        });
      } catch {
        /* cross-origin */
      }
    });
  } catch {
    /* styleSheets */
  }

  // --- Font stacks from key elements (dedupe later in Node) ---
  sampleElements('h1', 5).forEach(pushFontStack);
  sampleElements('body', 1).forEach(pushFontStack);

  function absolutizeUrl(u: string): string | null {
    try {
      return new URL(u, document.baseURI).href;
    } catch {
      return null;
    }
  }

  /** Extra sort key from common CDN query params and path patterns (width / WxH). */
  function urlResolutionHint(urlStr: string): number {
    let n = 0;
    try {
      const u = new URL(urlStr, document.baseURI);
      for (const k of ['w', 'width', 'max_w', 'mw', 'resize', 'size']) {
        const v = u.searchParams.get(k);
        if (v) {
          const parsed = parseInt(v.replace(/\D/g, ''), 10);
          if (parsed > 0) n = Math.max(n, parsed);
        }
      }
      const path = decodeURIComponent(u.pathname);
      const wSeg = path.match(/[/._-](\d{3,5})w(?=[/._-]|\.|$)/i);
      if (wSeg) n = Math.max(n, parseInt(wSeg[1], 10));
      const dim = path.match(/(\d{3,5})[x×](\d{3,5})/);
      if (dim) n = Math.max(n, parseInt(dim[1], 10) * parseInt(dim[2], 10));
    } catch {
      /* ignore */
    }
    return n;
  }

  /** Use original asset URL instead of Next.js resized proxy when possible. */
  function tryUnwrapNextImageUrl(href: string): string | null {
    try {
      const u = new URL(href, document.baseURI);
      if (!u.pathname.includes('/_next/image')) return null;
      const inner = u.searchParams.get('url');
      if (!inner) return null;
      const decoded = decodeURIComponent(inner);
      return absolutizeUrl(decoded);
    } catch {
      return null;
    }
  }

  function resolveRasterImageUrl(href: string): string {
    if (href.startsWith('data:')) return href;
    const inner = tryUnwrapNextImageUrl(href);
    return inner || href;
  }

  function viewportAreaPx(): number {
    return Math.max(1, window.innerWidth * window.innerHeight);
  }

  /** True when the box is a large hero / section fill (background-style use). */
  function isLargeCoveringRect(rect: DOMRectReadOnly): boolean {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.max(0, rect.width);
    const h = Math.max(0, rect.height);
    const a = w * h;
    const va = viewportAreaPx();
    if (a < 72_000) return false;
    const frac = a / va;
    if (frac >= 0.2) return true;
    if (w >= vw * 0.75 && h >= vh * 0.22) return true;
    if (h >= vh * 0.42 && w >= vw * 0.45) return true;
    return false;
  }

  /**
   * Pick the highest-resolution candidate from a srcset string (max `w` or `x`),
   * then break ties with URL dimension hints and later list position (often ascending sizes).
   */
  function bestUrlFromSrcsetString(srcset: string): { url: string; score: number } | null {
    let best: { url: string; score: number; hint: number; idx: number } | null = null;
    let idx = 0;
    const parts = srcset.split(',');
    for (let p = 0; p < parts.length; p++) {
      const trimmed = parts[p].trim();
      if (!trimmed) continue;
      const bits = trimmed.split(/\s+/);
      const rawUrl = bits[0];
      if (!rawUrl) {
        idx++;
        continue;
      }
      const abs = absolutizeUrl(rawUrl);
      if (!abs || abs.startsWith('data:')) {
        idx++;
        continue;
      }
      let score = 0;
      for (let i = 1; i < bits.length; i++) {
        const d = bits[i];
        if (d.endsWith('w')) score = Math.max(score, parseInt(d, 10) || 0);
        else if (d.endsWith('x')) score = Math.max(score, Math.round((parseFloat(d) || 1) * 100000));
      }
      if (bits.length === 1) score = Math.max(score, 1);
      const hint = urlResolutionHint(abs);
      if (
        !best ||
        score > best.score ||
        (score === best.score && (hint > best.hint || (hint === best.hint && idx > best.idx)))
      ) {
        best = { url: abs, score, hint, idx };
      }
      idx++;
    }
    if (!best) return null;
    return { url: best.url, score: best.score * 1e12 + best.hint };
  }

  function collectImgCandidates(img: HTMLImageElement): { url: string; score: number }[] {
    const out: { url: string; score: number }[] = [];
    const srcsetAttrs = [
      img.getAttribute('srcset'),
      img.getAttribute('data-srcset'),
      img.getAttribute('data-lazy-srcset'),
    ];
    for (const ss of srcsetAttrs) {
      if (!ss) continue;
      const b = bestUrlFromSrcsetString(ss);
      if (b) out.push(b);
    }
    const plainAttrs = [
      img.getAttribute('data-src'),
      img.getAttribute('data-lazy-src'),
      img.getAttribute('data-original'),
      img.getAttribute('data-zoom-src'),
      img.getAttribute('src'),
    ];
    const seenPlain = new Set<string>();
    for (const s of plainAttrs) {
      if (!s) continue;
      const abs = absolutizeUrl(s);
      if (!abs || abs.startsWith('data:') || seenPlain.has(abs)) continue;
      seenPlain.add(abs);
      const hint = urlResolutionHint(abs);
      out.push({ url: abs, score: hint * 5000 + (hint > 0 ? 50_000_000 : 100) });
    }
    return out;
  }

  function collectPictureCandidates(picture: Element, img: HTMLImageElement): { url: string; score: number }[] {
    const out: { url: string; score: number }[] = [];
    picture.querySelectorAll('source[srcset]').forEach((source) => {
      const ss = source.getAttribute('srcset');
      if (!ss) return;
      const b = bestUrlFromSrcsetString(ss);
      if (b) out.push(b);
    });
    for (const c of collectImgCandidates(img)) out.push(c);
    return out;
  }

  function pickBestCandidate(cands: { url: string; score: number }[]): string | null {
    if (!cands.length) return null;
    return cands.reduce((a, b) => (b.score > a.score ? b : a)).url;
  }

  /** All responsive / lazy variants (deduped), highest score first — `<picture><source>` + `img` src/srcset. */
  function sortedUniqueRasterUrls(cands: { url: string; score: number }[]): string[] {
    const sorted = [...cands].sort((a, b) => b.score - a.score);
    const urls: string[] = [];
    const localSeen = new Set<string>();
    for (const c of sorted) {
      const r = resolveRasterImageUrl(c.url);
      if (!r || localSeen.has(r)) continue;
      localSeen.add(r);
      urls.push(r);
    }
    return urls;
  }

  function collectAllRasterUrlsFromPicture(picture: Element, img: HTMLImageElement): string[] {
    const cands = collectPictureCandidates(picture, img);
    const urls = sortedUniqueRasterUrls(cands);
    const localSeen = new Set(urls);
    picture.querySelectorAll('source[src]').forEach((srcEl) => {
      const type = (srcEl.getAttribute('type') || '').trim().toLowerCase();
      if (type && !type.startsWith('image/')) return;
      const href = srcEl.getAttribute('src');
      if (!href) return;
      const abs = absolutizeUrl(href);
      if (!abs) return;
      const r = resolveRasterImageUrl(abs);
      if (localSeen.has(r)) return;
      localSeen.add(r);
      urls.push(r);
    });
    return urls;
  }

  /** All raster URLs from computed background-image (image-set + url layers). */
  function collectBackgroundImageCandidates(cssVal: string): { url: string; score: number }[] {
    const out: { url: string; score: number }[] = [];
    if (!cssVal || cssVal === 'none') return out;

    const lower = cssVal.toLowerCase();
    const key = 'image-set';
    const pos = lower.indexOf(key);
    if (pos >= 0) {
      let i = pos + key.length;
      while (i < cssVal.length && /\s/.test(cssVal[i])) i++;
      if (cssVal[i] === '(') {
        let depth = 1;
        const start = i + 1;
        i++;
        while (i < cssVal.length && depth > 0) {
          if (cssVal[i] === '(') depth++;
          else if (cssVal[i] === ')') depth--;
          i++;
        }
        const inner = cssVal.slice(start, i - 1);
        const pairRe = /url\s*\(\s*["']?([^"')]+)["']?\s*\)[^,]*?(\d+(?:\.\d+)?)x/gi;
        let pm: RegExpExecArray | null;
        while ((pm = pairRe.exec(inner)) !== null) {
          const raw = pm[1].trim();
          if (raw.startsWith('data:') || /gradient/i.test(raw)) continue;
          const abs = absolutizeUrl(raw);
          if (!abs) continue;
          const dens = parseFloat(pm[2]) || 1;
          const hint = urlResolutionHint(abs);
          out.push({ url: abs, score: dens * 100_000 * 1e12 + hint });
        }
      }
    }
    if (out.length) return out;

    const urlRe = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(cssVal)) !== null) {
      const raw = m[1].trim();
      if (raw.startsWith('data:') || /gradient/i.test(raw)) continue;
      const abs = absolutizeUrl(raw);
      if (!abs) continue;
      const hint = urlResolutionHint(abs);
      out.push({ url: abs, score: 1e12 + hint });
    }
    return out;
  }

  let primaryLogoAssigned = false;

  function classifyRasterImg(img: HTMLImageElement): string {
    const rect = img.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const cls = (img.getAttribute('class') || '').toLowerCase();
    const inHeader = img.closest('header') != null;
    const inFooter = img.closest('footer') != null;
    const inNav = img.closest('nav, [role="navigation"]') != null;
    const inMain = img.closest('main, article, [role="main"]') != null;
    const inHero = img.closest('[class*="hero"], [class*="banner"]') != null;
    const fit = getStyle(img, 'object-fit').toLowerCase();
    const covers = fit === 'cover' || fit === 'fill';
    const va = viewportAreaPx();

    const a = img.closest('a');
    const href = a ? (a as HTMLAnchorElement).getAttribute('href') || '' : '';
    const homeHref =
      href === '/' ||
      href === '' ||
      href === `${location.origin}/` ||
      href === location.origin;

    const maxSide = Math.max(rect.width, rect.height);
    if (rect.width > 0 && rect.height > 0 && maxSide < 48 && area < 2800) return 'decorative';

    const logoHint = alt.includes('logo') || cls.includes('logo') || cls.includes('brand');

    if (inHeader && a && homeHref) {
      if (!primaryLogoAssigned) {
        primaryLogoAssigned = true;
        return 'primaryLogo';
      }
      return 'secondaryLogo';
    }
    if (inHeader && logoHint) {
      if (!primaryLogoAssigned && area > 500) {
        primaryLogoAssigned = true;
        return 'primaryLogo';
      }
      return 'secondaryLogo';
    }
    if (inHeader && area > 1200 && !primaryLogoAssigned) {
      primaryLogoAssigned = true;
      return 'primaryLogo';
    }
    if (inHeader) return 'secondaryLogo';
    if (inFooter && logoHint) return 'secondaryLogo';
    if (inFooter || inNav) return 'decorative';

    const largeCover = isLargeCoveringRect(rect);
    if (largeCover && (inHero || inMain) && (covers || area >= va * 0.14)) return 'background';
    if (inHero && largeCover) return 'background';
    if (inHero && area > 14_000 && covers) return 'background';

    if (inMain) return 'misc';
    return 'misc';
  }

  function pushImageryEntry(url: string, role: string, el: Element, alt?: string) {
    const resolved = resolveRasterImageUrl(url);
    if (!resolved || seenUrls.has(resolved)) return;
    if (resolved.startsWith('data:') && !/^data:image\/svg\+xml/i.test(resolved)) return;
    if (imagery.length >= MAX_IMAGERY) return;
    seenUrls.add(resolved);
    let w: number | undefined;
    let h: number | undefined;
    if (el instanceof HTMLImageElement && el.naturalWidth) {
      w = el.naturalWidth;
      h = el.naturalHeight;
    }
    imagery.push({
      url: resolved,
      role,
      alt: alt || (el instanceof HTMLImageElement ? el.alt : undefined),
      width: w,
      height: h,
    });
  }

  const processedImgs = new WeakSet<Element>();

  document.querySelectorAll('picture').forEach((picture) => {
    const img = picture.querySelector('img');
    if (!(img instanceof HTMLImageElement) || !isVisible(img)) return;
    const urls = collectAllRasterUrlsFromPicture(picture, img);
    if (!urls.length) return;
    const role = classifyRasterImg(img);
    const alt = img.getAttribute('alt') || undefined;
    for (const url of urls) {
      pushImageryEntry(url, role, img, alt);
    }
    processedImgs.add(img);
  });

  document.querySelectorAll('img').forEach((img) => {
    if (!(img instanceof HTMLImageElement) || !isVisible(img)) return;
    if (processedImgs.has(img)) return;
    const cands = collectImgCandidates(img);
    const urls = sortedUniqueRasterUrls(cands);
    if (!urls.length) return;
    const role = classifyRasterImg(img);
    for (const url of urls) {
      pushImageryEntry(url, role, img, img.alt);
    }
  });

  document.querySelectorAll('video[poster]').forEach((node) => {
    if (!(node instanceof HTMLVideoElement) || !isVisible(node)) return;
    const poster = node.getAttribute('poster');
    if (!poster) return;
    const abs = absolutizeUrl(poster);
    if (!abs) return;
    const rect = node.getBoundingClientRect();
    const role = isLargeCoveringRect(rect) ? 'background' : 'misc';
    pushImageryEntry(abs, role, node, undefined);
  });

  // Background images — prefer highest-density image-set() / largest url() candidate per element
  const bgEls = Array.from(
    document.querySelectorAll('div, section, header, footer, main, article, a, span')
  ).filter(isVisible);
  let bgCount = 0;
  for (const el of bgEls) {
    if (bgCount >= MAX_BG_SCAN) break;
    const bi = getStyle(el, 'background-image');
    if (!bi || bi === 'none') continue;
    const bgCands = collectBackgroundImageCandidates(bi);
    if (!bgCands.length) continue;
    bgCands.sort((a, b) => b.score - a.score);
    const r = el.getBoundingClientRect();
    const role = isLargeCoveringRect(r) ? 'background' : 'decorative';
    let anyPushed = false;
    for (let i = 0; i < Math.min(bgCands.length, MAX_BG_URLS_PER_EL); i++) {
      const before = imagery.length;
      pushImageryEntry(bgCands[i].url, role, el, undefined);
      if (imagery.length > before) anyPushed = true;
    }
    if (anyPushed) bgCount++;
  }

  // --- Main brand logo candidates: only header / nav / footer, scored for home link + hints + size ---
  type ScoredLogo = RawLogo & { _score: number; _key: string; _order: number };
  const logoCandidates: ScoredLogo[] = [];
  let logoSeq = 0;

  function shellZoneForEl(el: Element): 'header' | 'nav' | 'footer' | null {
    if (el.closest('footer')) return 'footer';
    if (el.closest('header')) return 'header';
    if (el.closest('nav') || el.closest('[role="navigation"]')) return 'nav';
    return null;
  }

  function isHomeHref(href: string): boolean {
    const h = href.trim();
    const o = location.origin;
    if (h === '/' || h === '' || h === `${o}/` || h === o) return true;
    if (h === '#/' || h === '#' || h === `${o}/#`) return true;
    try {
      const u = new URL(h, location.href);
      if (u.origin !== location.origin) return false;
      const p = u.pathname.replace(/\/$/, '') || '/';
      return p === '' || p === '/';
    } catch {
      return false;
    }
  }

  function isHomeLinked(el: Element): boolean {
    const a = el.closest('a');
    if (!a) return false;
    return isHomeHref((a as HTMLAnchorElement).getAttribute('href') || '');
  }

  function logoHints(el: Element): boolean {
    const t =
      (el.getAttribute('alt') || '').toLowerCase() +
      (el.getAttribute('class') || '').toLowerCase() +
      (el.getAttribute('aria-label') || '').toLowerCase() +
      (el.getAttribute('title') || '').toLowerCase();
    return (
      t.includes('logo') ||
      t.includes('brand') ||
      t.includes('site title') ||
      t.includes('company name')
    );
  }

  function scoreShellImg(img: HTMLImageElement, zone: 'header' | 'nav' | 'footer'): number {
    const rect = img.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const home = isHomeLinked(img);
    const hint = logoHints(img);
    let s = 0;
    if ((zone === 'header' || zone === 'nav') && home) s += 1200;
    else if (zone === 'footer' && home) s += 780;
    if ((zone === 'header' || zone === 'nav') && hint) s += 560;
    if (zone === 'footer' && hint) s += 400;
    if ((zone === 'header' || zone === 'nav') && area >= 2200) s += 380;
    else if ((zone === 'header' || zone === 'nav') && area >= 900) s += 290;
    if (zone === 'footer' && area >= 1600) s += 240;
    if (hint) s += 120;
    if (area < 500) s -= 200;
    if (area < 140) s -= 450;
    return s;
  }

  function scoreShellSvg(svg: SVGElement, zone: 'header' | 'nav' | 'footer'): number {
    const rect = svg.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const home = isHomeLinked(svg);
    const hint = logoHints(svg);
    let s = 0;
    if ((zone === 'header' || zone === 'nav') && home) s += 1180;
    else if (zone === 'footer' && home) s += 760;
    if ((zone === 'header' || zone === 'nav') && hint) s += 540;
    if (zone === 'footer' && hint) s += 380;
    if (area >= 500) s += 220;
    if (area < 100) s -= 400;
    if (hint) s += 100;
    return s;
  }

  const seenLogoEls = new WeakSet<Element>();

  document
    .querySelectorAll('header img, footer img, nav img, [role="navigation"] img')
    .forEach((node) => {
      if (!(node instanceof HTMLImageElement) || !isVisible(node) || seenLogoEls.has(node)) return;
      seenLogoEls.add(node);
      const zone = shellZoneForEl(node);
      if (!zone) return;
      const score = scoreShellImg(node, zone);
      if (score < 90) return;
      const cands = collectImgCandidates(node);
      const picked = pickBestCandidate(cands);
      const fallback = node.getAttribute('src');
      const rawBest = picked || (fallback ? absolutizeUrl(fallback) : null);
      if (!rawBest || rawBest.startsWith('data:')) return;
      const abs = resolveRasterImageUrl(rawBest);
      const isSvgUrl = /\.svg(\?|$)/i.test(abs);
      logoCandidates.push({
        url: abs,
        kind: isSvgUrl ? 'svg-url' : 'raster',
        role: 'logo',
        selectorHint: describeElement(node),
        alt: node.alt || undefined,
        _score: score,
        _key: abs,
        _order: logoSeq++,
      });
    });

  document
    .querySelectorAll('header svg, footer svg, nav svg, [role="navigation"] svg')
    .forEach((node) => {
      if (!(node instanceof SVGElement) || !isVisible(node) || seenLogoEls.has(node)) return;
      const parentSvg = node.parentElement?.closest('svg');
      if (parentSvg && parentSvg !== node) return;
      seenLogoEls.add(node);
      const zone = shellZoneForEl(node);
      if (!zone) return;
      const score = scoreShellSvg(node, zone);
      if (score < 85) return;
      const preview = node.outerHTML.slice(0, MAX_INLINE_SVG);
      logoCandidates.push({
        kind: 'svg-inline',
        role: 'logo',
        selectorHint: describeElement(node),
        inlineSvgPreview: preview,
        _score: score,
        _key: `inline:${describeElement(node)}:${preview.slice(0, 80)}`,
        _order: logoSeq++,
      });
    });

  const byKey = new Map<string, ScoredLogo>();
  for (const c of logoCandidates) {
    const prev = byKey.get(c._key);
    if (!prev || c._score > prev._score) byKey.set(c._key, c);
  }

  const ranked = Array.from(byKey.values()).sort((a, b) =>
    b._score !== a._score ? b._score - a._score : a._order - b._order
  );

  const STRONG = 380;
  let picks = ranked.filter((c) => c._score >= STRONG).slice(0, 3);
  if (picks.length === 0 && ranked.length > 0) {
    picks = ranked.slice(0, 1).filter((c) => c._score >= 120);
  }
  if (picks.length === 0 && ranked.length > 0) {
    picks = ranked.slice(0, 1);
  }

  for (const c of picks) {
    if (logosAndMarks.length >= MAX_LOGOS) break;
    logosAndMarks.push({
      url: c.url,
      kind: c.kind,
      role: c.role,
      selectorHint: c.selectorHint,
      alt: c.alt,
      inlineSvgPreview: c.inlineSvgPreview,
    });
  }

  // Inline SVGs as imagery (excluding chrome logos already tied to seenLogoEls)
  document.querySelectorAll('svg').forEach((node) => {
    if (!(node instanceof SVGElement) || !isVisible(node)) return;
    const parentSvg = node.parentElement?.closest('svg');
    if (parentSvg && parentSvg !== node) return;
    if (seenLogoEls.has(node)) return;
    const raw = node.outerHTML;
    if (raw.length > MAX_INLINE_SVG) return;
    let dataUrl: string;
    try {
      dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(raw);
    } catch {
      return;
    }
    const rect = node.getBoundingClientRect();
    let role = 'misc';
    if (Math.max(rect.width, rect.height) < 56 && Math.max(1, rect.width) * Math.max(1, rect.height) < 3200) {
      role = 'decorative';
    } else if (isLargeCoveringRect(rect)) {
      role = 'background';
    }
    pushImageryEntry(dataUrl, role, node, undefined);
  });

  return {
    semanticColors,
    fontStacks,
    fontFaceRules,
    stylesheetHrefs,
    imagery,
    logosAndMarks,
  };
}
