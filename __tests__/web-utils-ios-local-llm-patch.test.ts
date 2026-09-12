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
 * The widened gate can reach the app two ways, and this test accepts either:
 * - the pnpm patch (patches/@iblai__web-utils@*.patch) on the registry
 *   package — keyed to an exact version, so a version bump silently drops it;
 * - a yalc-linked / released SDK build that carries the change in source
 *   (the formatter there splits the condition across lines, hence the
 *   whitespace-insensitive matching).
 *
 * If it fails, whichever channel is active lost the gate: re-apply the patch
 * for the new version, or rebuild+push the SDK — until the change ships in a
 * release, at which point the patch and this test can retire.
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
      const flat = src.replace(/\s+/g, '');
      expect(src).toContain('function isTauriEmbeddedLLMHost()');
      expect(flat).toContain(
        'if((isTauriDesktop()||isTauriEmbeddedLLMHost())&&isLocalLLMEnabled())',
      );
      // Coding Mode must NOT have been widened along with it.
      expect(flat).not.toContain('isTauriEmbeddedLLMHost()&&isCodingMode');
      expect(flat).not.toContain('isTauriEmbeddedLLMHost())&&isCodingMode');
    },
  );
});
