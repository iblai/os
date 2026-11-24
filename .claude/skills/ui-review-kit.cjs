// UI review kit: renders a screen at desktop / tablet / mobile, overlays the
// measured height of every row and the vertical gap to the next one, and builds
// a before/after contact sheet. See .claude/skills/ui-review.md for usage.
const fs = require('fs');
const path = require('path');
// Maps system-ui / sans-serif to Inter when the demo-video skill's fontconfig
// is installed in ~/.claude/skills; otherwise Linux falls back to DejaVu Sans.
const fontEnv = (() => {
  try {
    return require(
      path.join(
        require('os').homedir(),
        '.claude',
        'skills',
        'demo-video',
        'demo-kit.js',
      ),
    ).fontEnv;
  } catch {
    return () => process.env;
  }
})();

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  tablet: {
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

const PALETTE = [
  '#2563eb',
  '#dc2626',
  '#7c3aed',
  '#d97706',
  '#0891b2',
  '#be185d',
  '#4d7c0f',
];

// Runs in the page. Items are the children of every vertical stack under the
// root (or the elements matching `items`), minus anything nested inside
// another item, so a row is measured as a row and not as its label.
function collectInPage({ root, items, maxItemHeight }) {
  const rootEl =
    typeof root === 'string' ? document.querySelector(root) : document.body;
  if (!rootEl) throw new Error(`ui-review: root not found: ${root}`);
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return (
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== 'hidden' &&
      cs.display !== 'none'
    );
  };
  const rootW = rootEl.getBoundingClientRect().width;
  let groups = [];
  if (items) {
    const byParent = new Map();
    for (const e of rootEl.querySelectorAll(items)) {
      if (!vis(e)) continue;
      if (!byParent.has(e.parentElement)) byParent.set(e.parentElement, []);
      byParent.get(e.parentElement).push(e);
    }
    groups = [...byParent.values()];
  } else {
    const walk = (el, depth) => {
      if (depth > 12 || el.id === '__uirev') return;
      const kids = [...el.children].filter(vis);
      const rects = kids.map((k) => k.getBoundingClientRect());
      const vertical =
        kids.length >= 2 &&
        rects.every((r, i) => i === 0 || r.top >= rects[i - 1].bottom - 1);
      if (vertical) {
        const sized = kids.filter((k, i) => {
          const r = rects[i];
          return (
            r.height <= maxItemHeight && r.height >= 8 && r.width >= rootW * 0.3
          );
        });
        if (sized.length) groups.push(sized);
      }
      kids.forEach((k) => walk(k, depth + 1));
    };
    walk(rootEl, 0);
  }
  const all = [];
  groups.forEach((g, gi) => g.forEach((e) => all.push({ e, gi })));
  // A wrapper whose full-width children are themselves rows is a container,
  // not a row: measure its rows instead. A row's own label/description
  // column is narrower than the row, so rows are kept whole.
  const isContainer = (a) => {
    const ar = a.e.getBoundingClientRect();
    const inner = all.filter(
      (b) =>
        b !== a &&
        a.e.contains(b.e) &&
        b.e.getBoundingClientRect().width >= ar.width * 0.8,
    );
    return inner.length >= 2;
  };
  const rows = all.filter((a) => !isContainer(a));
  const kept = rows.filter(
    (a) => !rows.some((b) => b !== a && b.e.contains(a.e)),
  );
  kept.sort(
    (a, b) => a.e.getBoundingClientRect().top - b.e.getBoundingClientRect().top,
  );
  window.__uirevItems = kept;
  return kept.length;
}

function measureInPage() {
  const scrollY = window.scrollY;
  const out = window.__uirevItems.map(({ e, gi }, i, arr) => {
    const r = e.getBoundingClientRect();
    const next = arr
      .slice(i + 1)
      .find((n) => n.e.getBoundingClientRect().top >= r.bottom - 1);
    const gap = next ? next.e.getBoundingClientRect().top - r.bottom : null;
    const cs = getComputedStyle(e.parentElement);
    return {
      i,
      group: gi,
      text: (e.innerText || e.getAttribute('aria-label') || e.tagName)
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 60),
      top: +(r.top + scrollY).toFixed(1),
      height: +r.height.toFixed(1),
      gapToNext: gap === null ? null : +gap.toFixed(1),
      cls: typeof e.className === 'string' ? e.className : '',
      parentCls:
        typeof e.parentElement.className === 'string'
          ? e.parentElement.className
          : '',
      parentGap: cs.rowGap,
    };
  });
  return out;
}

function drawInPage({ palette, scrollEl }) {
  document.getElementById('__uirev')?.remove();
  const layer = document.createElement('div');
  layer.id = '__uirev';
  let clip = '';
  if (scrollEl && window.__uirevScroll) {
    const s = window.__uirevScroll.getBoundingClientRect();
    clip = `clip-path:inset(${s.top}px ${innerWidth - s.right}px ${innerHeight - s.bottom}px ${s.left}px);`;
  }
  layer.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:2147483647;${clip}`;
  document.body.appendChild(layer);
  const items = window.__uirevItems;
  const small = innerWidth < 600;
  const font = `600 ${small ? 9 : 11}px ui-monospace,monospace`;
  const tag = (x, y, txt, col) => {
    const t = document.createElement('div');
    t.textContent = txt;
    t.style.cssText = `position:fixed;left:${x}px;top:${y}px;font:${font};color:#fff;background:${col};padding:0 4px;border-radius:3px;white-space:nowrap`;
    layer.appendChild(t);
  };
  items.forEach(({ e, gi }, i) => {
    const b = e.getBoundingClientRect();
    const col = palette[gi % palette.length];
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;outline:1px solid ${col};background:${col}1f`;
    layer.appendChild(d);
    tag(
      b.right - (small ? 34 : 44),
      b.top + b.height / 2 - 7,
      `h ${Math.round(b.height)}`,
      col,
    );
    const next = items
      .slice(i + 1)
      .find((n) => n.e.getBoundingClientRect().top >= b.bottom - 1);
    if (!next) return;
    const nb = next.e.getBoundingClientRect();
    const g = nb.top - b.bottom;
    if (g <= 0) return;
    const x = b.left + Math.min(b.width * 0.55, 600);
    const bar = document.createElement('div');
    bar.style.cssText = `position:fixed;left:${x}px;top:${b.bottom}px;width:3px;height:${g}px;background:#059669`;
    layer.appendChild(bar);
    tag(x + 6, b.bottom + g / 2 - 7, `gap ${+g.toFixed(1)}`, '#059669');
  });
}

function findScrollInPage() {
  let el = window.__uirevItems[0]?.e.parentElement;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (
      el.scrollHeight > el.clientHeight + 2 &&
      /auto|scroll/.test(cs.overflowY)
    )
      break;
    el = el.parentElement;
  }
  window.__uirevScroll = el && el !== document.body ? el : null;
  const s = window.__uirevScroll;
  return s
    ? { inner: true, sh: s.scrollHeight, ch: s.clientHeight }
    : {
        inner: false,
        sh: document.documentElement.scrollHeight,
        ch: innerHeight,
      };
}

// Measures and annotates the current page. Writes <name>-<n>.png per scroll
// step plus <name>.json, and returns { shots, items }.
async function annotate(
  page,
  {
    outDir,
    name,
    root = null,
    items = null,
    maxItemHeight = 160,
    maxShots = 6,
  },
) {
  fs.mkdirSync(outDir, { recursive: true });
  const count = await page.evaluate(collectInPage, {
    root,
    items,
    maxItemHeight,
  });
  if (!count)
    throw new Error('ui-review: no rows found; pass `root` and/or `items`');
  const data = await page.evaluate(measureInPage);
  fs.writeFileSync(
    path.join(outDir, `${name}.json`),
    JSON.stringify(data, null, 1),
  );
  const sc = await page.evaluate(findScrollInPage);
  const shots = [];
  const step = sc.ch * 0.8;
  for (let i = 0; i < maxShots; i++) {
    const y = Math.min(i * step, Math.max(0, sc.sh - sc.ch));
    await page.evaluate(
      ({ y, inner }) =>
        inner ? (window.__uirevScroll.scrollTop = y) : window.scrollTo(0, y),
      { y, inner: sc.inner },
    );
    await page.waitForTimeout(250);
    await page.evaluate(drawInPage, { palette: PALETTE, scrollEl: sc.inner });
    const file = path.join(outDir, `${name}-${i + 1}.png`);
    await page.screenshot({ path: file });
    shots.push(file);
    if (y >= sc.sh - sc.ch) break;
  }
  await page.evaluate(() => document.getElementById('__uirev')?.remove());
  return { shots, items: data };
}

// Opens `url` at each viewport, runs `prepare(page, viewportName)` (log in,
// open a modal, switch a tab…), then annotates. Returns { desktop: {...}, … }.
async function reviewViewports(
  chromium,
  {
    url,
    outDir,
    tag,
    prepare,
    storageState,
    viewports = Object.keys(VIEWPORTS),
    root,
    items,
    maxItemHeight,
  },
) {
  const browser = await chromium.launch({ env: fontEnv() });
  const result = {};
  try {
    for (const vp of viewports) {
      const ctx = await browser.newContext(
        Object.assign({}, VIEWPORTS[vp], storageState ? { storageState } : {}),
      );
      const page = await ctx.newPage();
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (prepare) await prepare(page, vp);
      result[vp] = await annotate(page, {
        outDir,
        name: `${tag}-${vp}`,
        root,
        items,
        maxItemHeight,
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return result;
}

// One image per viewport (<out>-<viewport>.png): Before | After columns, a
// row per scroll step, so the lower part of a long screen is covered too.
// Returns the image paths.
async function contactSheet(
  chromium,
  { before, after, out, title = 'UI review' },
) {
  const uri = (f) =>
    `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  const width = { desktop: 1800, tablet: 1400, mobile: 960 };
  const vps = [
    ...new Set([...Object.keys(before || {}), ...Object.keys(after || {})]),
  ];
  const base = out.replace(/\.png$/, '');
  const files = [];
  const browser = await chromium.launch({ env: fontEnv() });
  try {
    for (const vp of vps) {
      const cols = before
        ? [
            ['Before', before[vp]],
            ['After', after?.[vp]],
          ]
        : [['Current', after?.[vp]]];
      const steps = Math.max(
        ...cols.map(([, r]) => (r ? r.shots.length : 0)),
        1,
      );
      const cell = (r, i) =>
        r && r.shots[i]
          ? `<img src="${uri(r.shots[i])}">`
          : '<div class="none">—</div>';
      const head = cols.map(([l]) => `<div class="h">${l}</div>`).join('');
      const body = Array.from({ length: steps }, (_, i) =>
        cols.map(([, r]) => cell(r, i)).join(''),
      ).join('');
      const html = `<!doctype html><meta charset="utf-8"><style>
        body{margin:0;padding:20px;background:#f3f4f6;font:14px Inter,system-ui,sans-serif;color:#111827}
        h1{margin:0 0 12px;font-size:18px}
        .grid{display:grid;grid-template-columns:repeat(${cols.length},minmax(0,1fr));gap:12px;align-items:start}
        .h{font-weight:700;font-size:13px;color:#374151}
        img{width:100%;border:1px solid #d1d5db;border-radius:6px;background:#fff}
        .none{padding:24px;color:#6b7280;border:1px dashed #d1d5db;border-radius:6px;text-align:center}
      </style><h1>${title} · ${vp}</h1><div class="grid">${head}${body}</div>`;
      const page = await browser.newPage({
        viewport: { width: width[vp] || 1600, height: 900 },
      });
      await page.setContent(html, { waitUntil: 'load' });
      const file = `${base}-${vp}.png`;
      await page.screenshot({ path: file, fullPage: true });
      await page.close();
      files.push(file);
    }
  } finally {
    await browser.close();
  }
  return files;
}

// Gap values per item group, to spot rows of the same kind spaced differently.
function summarize(items) {
  const byGroup = {};
  for (const it of items) {
    if (it.gapToNext === null) continue;
    (byGroup[it.group] ||= []).push(it.gapToNext);
  }
  return Object.entries(byGroup).map(([g, gaps]) => ({
    group: +g,
    gaps: [...new Set(gaps)].sort((a, b) => a - b),
    count: gaps.length,
  }));
}

module.exports = {
  VIEWPORTS,
  annotate,
  reviewViewports,
  contactSheet,
  summarize,
};
