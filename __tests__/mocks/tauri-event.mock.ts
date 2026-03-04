/**
 * Mock implementation of @tauri-apps/api/event for testing
 */

export const listen = async <T>(
  _event: string,
  _handler: (event: { payload: T }) => void,
): Promise<() => void> => {
  // Return a no-op unlisten function
  return () => {};
};

export default { listen };
