import { describe, it, expect } from 'vitest';
import {
  isDataUrl,
  dataUrlToFile,
  buildEmbedIconSelectionData,
  buildFloatingBubbleConfigFromSettings,
  hasCustomIconData,
} from '../utils';
import type { CustomFloatingBubbleConfig } from '../hooks/useEmbedTab';

// A minimal 1x1 transparent PNG data URL.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const baseConfig: CustomFloatingBubbleConfig = {
  image: 'https://cdn.example.com/icon.png',
  position: 'bottom-right',
  size: 'small',
  backgroundColor: 'transparent',
  textColor: '#ffffff',
  subtitleTextColor: '#e5e7eb',
  accentColor: '#1d4ed8',
  borderRadius: 16,
  shadow: false,
  title: 'Hello',
  subtitle: 'World',
  height: 48,
  fontSize: 14,
  subtitleFontSize: 12,
  padding: 12,
  imageSize: 32,
  strokeColor: '#000',
  strokeWidth: 0,
};

describe('isDataUrl', () => {
  it('returns true for a data URL', () => {
    expect(isDataUrl(PNG_DATA_URL)).toBe(true);
    expect(isDataUrl('data:text/plain;base64,aGk=')).toBe(true);
  });

  it('returns false for a resolved URL, relative path, null or undefined', () => {
    expect(isDataUrl('https://cdn.example.com/icon.png')).toBe(false);
    expect(isDataUrl('/message-circle.svg')).toBe(false);
    expect(isDataUrl(null)).toBe(false);
    expect(isDataUrl(undefined)).toBe(false);
  });
});

describe('dataUrlToFile', () => {
  it('converts a PNG data URL into a File with the right mime + extension', () => {
    const file = dataUrlToFile(PNG_DATA_URL);
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe('image/png');
    expect(file?.name).toBe('embed-custom-image.png');
    expect((file as File).size).toBeGreaterThan(0);
  });

  it('honors a provided filename and keeps an explicit extension', () => {
    const file = dataUrlToFile(PNG_DATA_URL, 'launcher.webp');
    expect(file?.name).toBe('launcher.webp');
  });

  it('derives an extension from a "+suffix" mime type', () => {
    const file = dataUrlToFile('data:image/svg+xml;base64,PHN2Zy8+');
    expect(file?.type).toBe('image/svg+xml');
    expect(file?.name).toBe('embed-custom-image.svg');
  });

  it('falls back to octet-stream when the mime is absent', () => {
    const file = dataUrlToFile('data:;base64,aGk=');
    expect(file?.type).toBe('application/octet-stream');
    expect(file?.name).toBe('embed-custom-image.octet-stream');
  });

  it('returns null for a non-data URL', () => {
    expect(dataUrlToFile('https://cdn.example.com/icon.png')).toBeNull();
  });

  it('returns null when the data URL has no payload', () => {
    expect(dataUrlToFile('data:image/png;base64,')).toBeNull();
  });
});

describe('buildEmbedIconSelectionData', () => {
  it('serializes the config minus the image', () => {
    const data = buildEmbedIconSelectionData(baseConfig);
    expect(data).not.toHaveProperty('image');
    expect(data.title).toBe('Hello');
    expect(data.position).toBe('bottom-right');
  });

  it('does not embed an icon_selection key (mode is derived from existence)', () => {
    const data = buildEmbedIconSelectionData(baseConfig);
    expect(data).not.toHaveProperty('icon_selection');
  });
});

describe('hasCustomIconData', () => {
  it('returns true only for a non-empty object', () => {
    expect(hasCustomIconData({ title: 'x' })).toBe(true);
  });

  it('returns false for an empty object (the backend cleared state)', () => {
    expect(hasCustomIconData({})).toBe(false);
  });

  it('returns false for null, undefined, strings and other non-objects', () => {
    expect(hasCustomIconData(null)).toBe(false);
    expect(hasCustomIconData(undefined)).toBe(false);
    expect(hasCustomIconData('')).toBe(false);
    expect(hasCustomIconData('null')).toBe(false);
    expect(hasCustomIconData(0)).toBe(false);
  });
});

describe('buildFloatingBubbleConfigFromSettings', () => {
  it('derives iconSelection "custom" when a non-empty JSON map exists', () => {
    const result = buildFloatingBubbleConfigFromSettings(
      baseConfig,
      {
        title: 'Persisted',
        position: 'top-left',
      },
      'https://cdn.example.com/saved.png',
    );
    expect(result).not.toBeNull();
    expect(result?.iconSelection).toBe('custom');
    expect(result?.config.title).toBe('Persisted');
    expect(result?.config.position).toBe('top-left');
    expect(result?.config.image).toBe('https://cdn.example.com/saved.png');
    // Untouched fields fall back to defaults.
    expect(result?.config.borderRadius).toBe(16);
  });

  it('drops a legacy icon_selection key but still derives from existence', () => {
    const result = buildFloatingBubbleConfigFromSettings(
      baseConfig,
      // Older payloads may still carry this key; it is no longer authoritative.
      { icon_selection: 'default', title: 'Legacy' },
      null,
    );
    expect(result?.iconSelection).toBe('custom');
    expect(result?.config).not.toHaveProperty('icon_selection');
  });

  it('falls back to the default image when no custom image is provided', () => {
    const result = buildFloatingBubbleConfigFromSettings(
      baseConfig,
      { title: 'NoImage' },
      null,
    );
    expect(result?.config.image).toBe(baseConfig.image);
  });

  it('ignores a persisted image key inside the JSON map', () => {
    const result = buildFloatingBubbleConfigFromSettings(
      baseConfig,
      { image: 'data:should-be-ignored', title: 'X' },
      'https://cdn.example.com/real.png',
    );
    expect(result?.config.image).toBe('https://cdn.example.com/real.png');
  });

  it('hydrates from only a custom image and derives "default" (no JSON map)', () => {
    const result = buildFloatingBubbleConfigFromSettings(
      baseConfig,
      null,
      'https://cdn.example.com/only-image.png',
    );
    expect(result).not.toBeNull();
    expect(result?.config.image).toBe('https://cdn.example.com/only-image.png');
    // No JSON map => default mode even though a stale image URL lingers.
    expect(result?.iconSelection).toBe('default');
  });

  it('derives "default" when the JSON map is an empty string (cleared)', () => {
    const result = buildFloatingBubbleConfigFromSettings(
      baseConfig,
      '',
      'https://cdn.example.com/stale.png',
    );
    expect(result).not.toBeNull();
    expect(result?.iconSelection).toBe('default');
  });

  it('derives "default" when the JSON map is an empty object {} (backend cleared state)', () => {
    // The backend clears `embed_icon_selection_data` by storing `{}` (verified
    // live). An empty object still hydrates the config from defaults, but the
    // mode must be 'default'. A lingering image must NOT force 'custom'.
    const result = buildFloatingBubbleConfigFromSettings(
      baseConfig,
      {},
      'https://cdn.example.com/stale.png',
    );
    expect(result).not.toBeNull();
    expect(result?.iconSelection).toBe('default');
    // Config still hydrates (image from the stale URL, rest from defaults).
    expect(result?.config.image).toBe('https://cdn.example.com/stale.png');
    expect(result?.config.borderRadius).toBe(16);
  });

  it('returns null when there is neither icon data nor a custom image', () => {
    expect(
      buildFloatingBubbleConfigFromSettings(baseConfig, null, null),
    ).toBeNull();
    expect(
      buildFloatingBubbleConfigFromSettings(baseConfig, undefined, undefined),
    ).toBeNull();
  });

  it('treats a non-object icon-selection payload as absent', () => {
    expect(
      buildFloatingBubbleConfigFromSettings(baseConfig, 'not-an-object', null),
    ).toBeNull();
  });
});
