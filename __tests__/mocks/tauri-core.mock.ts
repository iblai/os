/**
 * Mock implementation of @tauri-apps/api/core for testing
 */

export const invoke = async <T>(
  _cmd: string,
  _args?: Record<string, unknown>,
): Promise<T> => {
  throw new Error('Tauri is not available in test environment');
};

export default { invoke };
