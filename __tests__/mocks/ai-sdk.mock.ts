/**
 * Mock implementation of the `ai` SDK for testing.
 *
 * The yalc-linked @iblai/web-utils bundle lazy-imports `ai` inside
 * Tauri-only code paths (guarded by `isTauri()`, which is always false under
 * jsdom). Vitest inlines that bundle (`server.deps.inline: true`), so Vite's
 * import-analysis still has to RESOLVE the specifier even though the import
 * never executes in tests. Aliasing it here keeps the SDK's peer packages out
 * of the app's package.json.
 */

const unavailable = (name: string) => () => {
  throw new Error(`ai.${name} is not available in the test environment`);
};

export const streamText = unavailable('streamText');
export const generateText = unavailable('generateText');
export const tool = unavailable('tool');
export const jsonSchema = unavailable('jsonSchema');

export default { streamText, generateText, tool, jsonSchema };
