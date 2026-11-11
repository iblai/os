/**
 * Mock implementation of @tauri-apps/api/core for testing.
 *
 * `vitest.config.ts` aliases `@tauri-apps/api/core` here, so every test gets
 * this instead of the real bridge, and calling a command fails loudly rather
 * than silently doing nothing.
 *
 * A test that needs commands to answer normally mocks the module itself
 * (`vi.mock('@tauri-apps/api/core', …)`). Where the code under test imports
 * the bridge lazily — `await import('@tauri-apps/api/core')` on each call —
 * that mock is not reliably applied to every one of those imports under
 * vitest 4: the first calls get the factory and a later one gets this file.
 * `setInvokeMock` is the way through for those tests. It lives on
 * `globalThis` deliberately, so it is found no matter which copy of this
 * module the import resolves to.
 */
type InvokeMock = (
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

declare global {
  // eslint-disable-next-line no-var
  var __iblTauriInvokeMock: InvokeMock | undefined;
}

/** Answer `invoke` with `impl` until `clearInvokeMock()`. */
export const setInvokeMock = (impl: InvokeMock): void => {
  globalThis.__iblTauriInvokeMock = impl;
};

/** Back to failing loudly. Pair with `setInvokeMock` in an `afterEach`. */
export const clearInvokeMock = (): void => {
  globalThis.__iblTauriInvokeMock = undefined;
};

export const invoke = async <T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  const impl = globalThis.__iblTauriInvokeMock;
  if (impl) return (await impl(cmd, args)) as T;
  throw new Error('Tauri is not available in test environment');
};

export default { invoke };
