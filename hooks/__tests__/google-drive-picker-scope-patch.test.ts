import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

// Regression guard for patches/google-drive-picker@1.1.29.patch.
//
// google-drive-picker hardcodes the RESTRICTED `drive.readonly` scope as its
// default and *prepends* it to whatever `customScopes` we pass:
//
//   scope: (e.customScopes ? [...S, ...e.customScopes] : S).join(' ')
//   // where S = ['https://www.googleapis.com/auth/drive.readonly']
//
// So even though our hooks request only `drive.file`, every auth call leaked
// `drive.readonly` to Google, which blocked OAuth verification. The patch sets
// the default `S = []` so only our `customScopes` (drive.file) are requested.
//
// There is no prop to disable the default and no fixed upstream release (1.1.29
// is the latest), so the patch is the fix. If it is ever dropped — removed, or
// the dependency bumped without re-patching — this test fails loudly instead of
// silently re-leaking the restricted scope.
const require = createRequire(import.meta.url);

describe('google-drive-picker scope patch', () => {
  const bundle = readFileSync(
    require.resolve('google-drive-picker/dist/bundle.js'),
    'utf8',
  );

  it('does not hardcode the restricted drive.readonly scope', () => {
    expect(bundle).not.toContain('drive.readonly');
  });

  it('requests no Google Drive scope by default (only customScopes are sent)', () => {
    expect(bundle).not.toContain('googleapis.com/auth/drive');
  });

  it('keeps the default scope list empty', () => {
    expect(bundle).toContain('S=[]');
  });
});
