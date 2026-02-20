// This function runs INSIDE the Chromium browser context via page.evaluate().
// It cannot import modules, use Node.js APIs, or close over external variables.
// It must be fully self-contained.
export function extractColorsFromDOM() {
  type RawColorEntry = { selector: string; property: string; value: string };

  const results: {
    primaryButtons: RawColorEntry[];
    elementBackgrounds: RawColorEntry[];
    pageBackgrounds: RawColorEntry[];
    textColors: RawColorEntry[];
    cssVariables: RawColorEntry[];
  } = {
    primaryButtons: [],
    elementBackgrounds: [],
    pageBackgrounds: [],
    textColors: [],
    cssVariables: [],
  };

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
    return `${tag}${id}${cls}`.slice(0, 60);
  }

  // 1. PRIMARY BUTTONS — buttons, submit inputs, role=button, and anchor tags
  const buttonSelectors = [
    'button',
    'a',
    '[type="submit"]',
    '[role="button"]',
    'a.btn',
    'a.button',
  ];
  document.querySelectorAll(buttonSelectors.join(',')).forEach((el) => {
    const bg = getStyle(el, 'background-color');
    const desc = describeElement(el);
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      results.primaryButtons.push({ selector: desc, property: 'background-color', value: bg });
    }
  });

  // 2. ELEMENT BACKGROUNDS — large containers with unique background-colors
  // Searches broadly for any block-level container that has a non-transparent bg
  const containerSelectors = [
    'div', 'section', 'article', 'aside', 'header', 'footer', 'nav',
    'main', '[class*="section"]', '[class*="container"]', '[class*="wrapper"]',
    '[class*="banner"]', '[class*="hero"]', '[class*="card"]', '[class*="panel"]',
  ];
  const containerEls = Array.from(
    document.querySelectorAll(containerSelectors.join(','))
  ).slice(0, 200);

  containerEls.forEach((el) => {
    const bg = getStyle(el, 'background-color');
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      // Only include elements with meaningful rendered size (skip tiny/hidden elements)
      const rect = el.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 50) {
        results.elementBackgrounds.push({
          selector: describeElement(el),
          property: 'background-color',
          value: bg,
        });
      }
    }
  });

  // 3. PAGE BACKGROUNDS — top-level structural elements only
  const pageBgSelectors = ['html', 'body', 'main', 'header', 'footer', '#root', '#__next', '#app'];
  pageBgSelectors.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const bg = getStyle(el, 'background-color');
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      results.pageBackgrounds.push({ selector: sel, property: 'background-color', value: bg });
    }
  });

  // 4. DOMINANT TEXT COLOR — count occurrences across text elements, return the most frequent
  const textTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'li'];
  const colorCounts: Record<string, number> = {};
  textTags.forEach((tag) => {
    Array.from(document.querySelectorAll(tag))
      .slice(0, 20)
      .forEach((el) => {
        const color = getStyle(el, 'color');
        if (color) colorCounts[color] = (colorCounts[color] ?? 0) + 1;
      });
  });

  const dominantColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
  if (dominantColor) {
    results.textColors.push({
      selector: 'dominant text color',
      property: 'color',
      value: dominantColor[0],
    });
  }

  // 5. CSS CUSTOM PROPERTIES (design tokens) — scan all stylesheets for --* color variables
  // getComputedStyle resolves var() on standard properties, but we also want the raw
  // token palette (e.g. --color-primary, --brand-blue) which may not be applied to any
  // specific element directly.
  const colorVarPattern = /(?:color|background|bg|fill|stroke|border|text|primary|secondary|accent|brand|surface|foreground|muted|highlight)/i;
  const cssColorPattern = /^(?:rgb|rgba|hsl|hsla|#[0-9a-f]{3,8}|\d)/i;
  const rootEl = document.documentElement;
  const rootStyles = window.getComputedStyle(rootEl);

  // Collect all --* custom property names from every stylesheet
  const varNames = new Set<string>();
  try {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules).forEach((rule) => {
          if (rule instanceof CSSStyleRule) {
            Array.from(rule.style).forEach((prop) => {
              if (prop.startsWith('--')) varNames.add(prop);
            });
          }
        });
      } catch {
        // cross-origin stylesheet — skip
      }
    });
  } catch {
    // styleSheets not accessible
  }

  // Also scan inline styles on :root / html / body for custom properties
  [document.documentElement, document.body].forEach((el) => {
    if (!el) return;
    Array.from(el.style).forEach((prop) => {
      if (prop.startsWith('--')) varNames.add(prop);
    });
  });

  varNames.forEach((varName) => {
    // Only look at variables whose name suggests a color
    if (!colorVarPattern.test(varName)) return;

    // Resolve the variable value via getComputedStyle on :root
    const resolved = rootStyles.getPropertyValue(varName).trim();
    if (!resolved) return;

    // If the resolved value is itself a var(), resolve it recursively via a temporary element
    let finalValue = resolved;
    if (resolved.startsWith('var(')) {
      const tmp = document.createElement('div');
      tmp.style.setProperty('--resolve', resolved);
      tmp.style.color = `var(--resolve)`;
      document.body.appendChild(tmp);
      finalValue = window.getComputedStyle(tmp).color;
      document.body.removeChild(tmp);
    }

    // Accept raw hex/rgb/hsl values; skip non-color strings
    if (!cssColorPattern.test(finalValue) && !finalValue.startsWith('#')) return;

    results.cssVariables.push({
      selector: varName,
      property: 'css-variable',
      value: finalValue,
    });
  });

  return results;
}
