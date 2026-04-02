/**
 * Type declarations for @tauri-apps/api
 * These are minimal type definitions for the Tauri APIs used in this package
 */

declare module '@tauri-apps/api/core' {
  export function invoke<T>(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T>;
}

declare module '@tauri-apps/api/event' {
  export interface Event<T> {
    payload: T;
  }

  export function listen<T>(
    event: string,
    handler: (event: Event<T>) => void,
  ): Promise<() => void>;
}
