import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

/**
 * Guard for the iOS local-LLM chat gate in `@iblai/web-utils`.
 *
 * The SDK's send-time gate was `isTauriDesktop()`, which excludes mobile; iOS,
 * however, ships an embedded Ollama-compatible runtime (src-tauri/local_llm.rs),
 * so the gate must be widened with `isTauriEmbeddedLLMHost()` (iOS only —
 * Coding Mode stays desktop-gated).
 *
 * The widened gate ships in the released SDK (web-utils ≥ 2.9), where the
 * send-time rule is: desktop-or-embedded host AND a local model in use (or
 * offline with Local Models on). This pins both halves against the installed
 * bundle — a yalc-linked or registry build alike (the formatter splits the
 * condition across lines and comments it, hence the comment-stripped,
 * whitespace-insensitive matching).
 *
 * If it fails, the installed SDK lost the gate: check the SDK's
 * use-chat-v2.ts send path before bumping the pin.
 */
describe('@iblai/web-utils iOS local-LLM gate', () => {
  const iblaiJsDir = realpathSync(
    path.join(process.cwd(), 'node_modules', '@iblai', 'iblai-js'),
  );
  const requireFromIblaiJs = createRequire(
    path.join(iblaiJsDir, 'package.json'),
  );
  // The package's `exports` map hides package.json, so resolve the entry
  // module (…/dist/index.js) and address both bundles from its directory.
  const distDir = path.dirname(requireFromIblaiJs.resolve('@iblai/web-utils'));

  it.each(['index.esm.js', 'index.js'])(
    'keeps the widened send-time gate in %s',
    (bundle) => {
      const src = readFileSync(path.join(distDir, bundle), 'utf8');
      // Comments are stripped before flattening: the released build keeps
      // comments inside the condition, which a literal match would trip over.
      const flat = src.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
      expect(src).toContain('function isTauriEmbeddedLLMHost()');
      // The host half of the gate: desktop OR the embedded runtime. The other
      // half (a local model actually in use, or offline with Local Models on)
      // is the routing rule shipped in web-utils 2.9; both halves are asserted.
      expect(flat).toContain(
        'if((isTauriDesktop()||isTauriEmbeddedLLMHost())&&(hasLocalLLMInUse()||',
      );
      expect(flat).toContain('&&isLocalLLMEnabled())))');
      // Coding Mode must NOT have been widened along with it.
      expect(flat).not.toContain('isTauriEmbeddedLLMHost()&&isCodingMode');
      expect(flat).not.toContain('isTauriEmbeddedLLMHost())&&isCodingMode');
    },
  );
});
