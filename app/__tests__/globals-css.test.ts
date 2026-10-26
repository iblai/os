import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(resolve(__dirname, '../globals.css'), 'utf8');

describe('globals.css', () => {
  // #121: on iOS a swipe on the chat scrolled the app shell and left a blank
  // gap below the chat card.
  it('stops html and body from overscrolling', () => {
    expect(css).toMatch(/html,\s*body\s*{\s*overscroll-behavior:\s*none;?\s*}/);
  });
});
