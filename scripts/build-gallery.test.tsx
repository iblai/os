/**
 * Not a test — a generator. Renders every gallery case through the real
 * <Markdown> component and writes public/markdown-gallery.html so the whole
 * render surface can be reviewed on one page. Run via:
 *   pnpm vitest run scripts/build-gallery.test.tsx
 */
import { render } from '@testing-library/react';
import { describe, it } from 'vitest';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import Markdown from '@/components/markdown';
import { markdownToHtml } from '@/lib/utils';
import { GALLERY } from './gallery-cases';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

describe('gallery', () => {
  it('builds', () => {
    const cssDir = '.next/static/css';
    const css = readdirSync(cssDir)
      .map((f) => ({ f, n: readFileSync(`${cssDir}/${f}`, 'utf8').length }))
      .sort((a, b) => b.n - a.n)[0].f;
    const appCss = readFileSync(`${cssDir}/${css}`, 'utf8');
    const katexCss = readFileSync(
      'node_modules/katex/dist/katex.min.css',
      'utf8',
    );

    let body = '';
    let total = 0;
    let errs = 0;
    for (const g of GALLERY) {
      body += `<section><h2>${esc(g.group)}</h2><p class="blurb">${esc(g.blurb)}</p>`;
      for (const c of g.cases) {
        total++;
        const { container } = render(<Markdown>{c.md}</Markdown>);
        const e = container.querySelectorAll('.katex-error').length;
        errs += e;
        const canvas = markdownToHtml(c.md);
        const canvasErr = (canvas.match(/katex-error/g) || []).length;
        body += `<article data-case="${c.id}" ${e ? 'data-err' : ''}>
  <header><code>${c.id}</code> <b>${esc(c.label)}</b>
    ${e ? `<span class="badge err">${e} katex error${e > 1 ? 's' : ''}</span>` : ''}
    ${canvasErr !== e ? `<span class="badge warn">canvas differs (${canvasErr})</span>` : ''}
  </header>
  ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
  <pre class="src">${esc(c.md)}</pre>
  <div class="out">${container.innerHTML}</div>
</article>`;
      }
      body += '</section>';
    }

    writeFileSync(
      'public/markdown-gallery.html',
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Markdown render gallery</title>
<style>${katexCss}</style><style>${appCss}</style>
<style>
:root{--fg:#111;--mut:#666;--line:#d8d8d8;--bg:#fff;--card:#fafafa}
*{box-sizing:border-box}
body{margin:0;padding:32px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin-inline:auto}
h1{font-size:24px;margin:0 0 4px}
.lede{color:var(--mut);margin:0 0 8px}
.summary{display:flex;gap:20px;padding:12px 16px;background:var(--card);border:1px solid var(--line);border-radius:8px;margin:16px 0 28px;font-variant-numeric:tabular-nums}
.summary b{font-size:20px;display:block}
.summary span{color:var(--mut);font-size:12px}
section{margin:0 0 36px}
h2{font-size:17px;margin:0 0 4px;padding-bottom:6px;border-bottom:2px solid var(--fg)}
.blurb{color:var(--mut);margin:0 0 14px;font-size:13px;max-width:78ch}
article{border:1px solid var(--line);border-radius:8px;margin-bottom:14px;overflow:hidden;background:#fff}
article[data-err]{border-color:#e0b4b4}
header{display:flex;align-items:center;gap:10px;padding:7px 12px;background:var(--card);border-bottom:1px solid var(--line);font-size:13px}
header code{font:12px ui-monospace,monospace;color:var(--mut);background:#eee;padding:1px 6px;border-radius:4px}
.badge{margin-left:auto;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600}
.badge.err{background:#fdecec;color:#a33}
.badge.warn{background:#fff4e0;color:#8a5a00}
.note{margin:0;padding:7px 12px;background:#fffbe9;border-bottom:1px solid #f0e4bc;font-size:12px;color:#6b5900}
.src{margin:0;padding:9px 12px;background:#fbfbfb;border-bottom:1px solid var(--line);font:12px/1.5 ui-monospace,monospace;color:#555;white-space:pre-wrap;word-break:break-word}
.out{padding:14px 12px}
.katex-error{outline:1px dashed #c66;outline-offset:2px}
</style></head><body>
<h1>Markdown render gallery</h1>
<p class="lede">Every case rendered through the real <code>&lt;Markdown&gt;</code> component — Streamdown + @ziloen/remark-math + rehype-katex — with the app's compiled CSS.</p>
<div class="summary">
  <div><b>${total}</b><span>cases</span></div>
  <div><b>${errs}</b><span>katex errors</span></div>
  <div><b>${GALLERY.length}</b><span>groups</span></div>
  <div><b>${new Date().toISOString().slice(0, 16).replace('T', ' ')}</b><span>generated (UTC)</span></div>
</div>
${body}</body></html>`,
    );
    console.log(`GALLERY_BUILT cases=${total} errors=${errs}`);
  });
});
