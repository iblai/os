import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const extensionDir = resolve(process.cwd(), 'extensions/chrome');

function extensionFile(name: string) {
  return readFileSync(resolve(extensionDir, name), 'utf8');
}

describe('Chrome side-panel media popup', () => {
  it('routes voice and screen-share actions out of the partitioned iframe', () => {
    const panelHtml = extensionFile('panel.html');
    const panelJs = extensionFile('panel.js');
    const agentBundle = extensionFile('vendor/agent-ai.umd.js');

    expect(panelHtml).toContain('enablechatactionpopup');
    expect(panelJs).toContain("agent.setAttribute('popupurl', original.href)");
    expect(panelJs).toContain(
      "agent.setAttribute('popupauthdata', JSON.stringify(session))",
    );
    expect(agentBundle).toContain('new URL(this.popupUrl || t.src)');
    expect(agentBundle).toContain('this.popupAuthData || n');
    expect(agentBundle).toContain(
      "'chrome-extension:' === window.location.protocol",
    );
    expect(agentBundle).toContain('setSelfAsOpener: !0');
  });

  it('does not add a nonexistent microphone manifest permission', () => {
    const manifest = JSON.parse(extensionFile('manifest.json')) as {
      permissions?: string[];
    };

    expect(manifest.permissions).not.toContain('microphone');
  });
});
