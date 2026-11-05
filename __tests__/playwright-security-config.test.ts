import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import mcpConfig from '../e2e/mcp.config';
import e2eConfig from '../e2e/playwright.config';

const repoRoot = path.resolve(__dirname, '..');

// Playwright leaves the Chromium sandbox off by default (`chromiumSandbox`
// defaults to false). The sandbox is the boundary between a browser bug and the
// developer's machine, so these guards fail loudly if someone removes it.
describe('Playwright Chromium sandbox', () => {
  it('is on for the agent-driven MCP browser, which can open untrusted pages', () => {
    const project = mcpConfig.projects?.[0];
    expect(project?.use?.launchOptions?.chromiumSandbox).toBe(true);
  });

  it('is on for e2e except in CI, where the root container cannot init it', () => {
    expect(e2eConfig.use?.launchOptions?.chromiumSandbox).toBe(!process.env.CI);
  });
});

// The CI image ships its own browser build, which must match the Playwright we
// install, or the e2e run uses a browser the test code was not built against.
describe('Playwright version pinning', () => {
  it('pins the e2e Docker base image to the installed @playwright/test', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    );
    const pinned = pkg.devDependencies['@playwright/test'];
    const dockerfile = readFileSync(
      path.join(repoRoot, 'e2e/Dockerfile'),
      'utf8',
    );
    const match = dockerfile.match(
      /mcr\.microsoft\.com\/playwright:v([\d.]+)-/,
    );
    expect(match?.[1]).toBe(pinned);
  });
});
