// The port protocol between the panel and the service worker. Its own module so
// that importing the message types does not pull in either side's module-level
// side effects (the worker registers listeners as soon as it is evaluated).
import type { Credentials, AgentEvent } from './agent';

/** The port name the panel connects on; anything else is ignored. */
export const BROWSE_PORT = 'browse';

export type InboundMessage =
  | {
      type: 'run';
      goal: string;
      creds: Credentials;
      tabId: number;
      /** Approvals = Automatic: act without raising a confirmation. */
      auto: boolean;
    }
  | { type: 'stop' }
  | { type: 'confirm'; id: number; ok: boolean };

export type OutboundMessage =
  /** The panel accepted a run and opened the port — the app's first sign of life. */
  | { type: 'ack' }
  | { type: 'event'; event: AgentEvent }
  | { type: 'log'; text: string; ok: boolean }
  | { type: 'confirm'; id: number; description: string }
  | { type: 'done'; text: string; note?: string }
  | { type: 'error'; message: string };
