import { describe, expect, it } from 'vitest';
import {
  cspWithMentorOrigin,
  DEFAULT_MENTOR_URL,
  MENTOR_ORIGIN_PLACEHOLDER,
} from '../mentor-origin';

// The shape the manifest actually ships: the placeholder in both framing
// directives, everything else already final.
const CSP =
  "script-src 'self'; " +
  `frame-src ${MENTOR_ORIGIN_PLACEHOLDER} https://*.ibl.ai https://accounts.google.com; ` +
  `child-src ${MENTOR_ORIGIN_PLACEHOLDER} https://*.ibl.ai`;

describe('cspWithMentorOrigin', () => {
  it('fills every placeholder and leaves the rest of the policy alone', () => {
    const csp = cspWithMentorOrigin(CSP, DEFAULT_MENTOR_URL);

    expect(csp).toBe(
      "script-src 'self'; " +
        'frame-src https://os.ibl.ai https://*.ibl.ai https://accounts.google.com; ' +
        'child-src https://os.ibl.ai https://*.ibl.ai',
    );
    expect(csp).not.toContain(MENTOR_ORIGIN_PLACEHOLDER);
  });

  // A CSP source is an origin: a path or a trailing slash makes the whole
  // directive invalid, and `.env.local` values are typed by hand.
  it('reduces the configured URL to its origin', () => {
    expect(cspWithMentorOrigin(CSP, 'http://localhost:3000/')).toContain(
      'frame-src http://localhost:3000 https://*.ibl.ai',
    );
    expect(
      cspWithMentorOrigin(CSP, 'https://app.example.com/platform/acme'),
    ).toContain('child-src https://app.example.com https://*.ibl.ai');
  });

  // Finding no placeholder is the build plugin's error to raise — it knows
  // which file was supposed to contain one.
  it('returns a policy with no placeholder unchanged', () => {
    expect(cspWithMentorOrigin("frame-src 'self'", DEFAULT_MENTOR_URL)).toBe(
      "frame-src 'self'",
    );
  });

  // Throwing here fails `pnpm ext:build`, which is the point: a URL the panel
  // could never load must not reach a packaged extension.
  it('throws on a URL it cannot parse', () => {
    expect(() => cspWithMentorOrigin(CSP, 'os.ibl.ai')).toThrow();
    expect(() => cspWithMentorOrigin(CSP, '')).toThrow();
  });
});
