import { describe, it, expect } from 'vitest';
import { validateWebsiteUrl } from '../utils';

describe('validateWebsiteUrl', () => {
  it('returns undefined for empty value', () => {
    expect(validateWebsiteUrl('')).toBeUndefined();
  });

  it('accepts a valid origin without trailing slash', () => {
    expect(validateWebsiteUrl('https://ibl.ai')).toBeUndefined();
  });

  it('accepts http scheme', () => {
    expect(validateWebsiteUrl('http://localhost:3000')).toBeUndefined();
  });

  it('accepts origin with port', () => {
    expect(validateWebsiteUrl('https://example.com:8080')).toBeUndefined();
  });

  it('rejects URL with trailing slash', () => {
    expect(validateWebsiteUrl('https://ibl.ai/')).toBe(
      'Remove the trailing slash (e.g. https://ibl.ai)',
    );
  });

  it('rejects URL with path', () => {
    expect(validateWebsiteUrl('https://ibl.ai/hello')).toBe(
      'URL should be origin only, without a path (e.g. https://ibl.ai)',
    );
  });

  it('rejects URL with nested path', () => {
    expect(validateWebsiteUrl('https://ibl.ai/a/b/c')).toBe(
      'URL should be origin only, without a path (e.g. https://ibl.ai)',
    );
  });

  it('rejects value without scheme', () => {
    expect(validateWebsiteUrl('ibl.ai')).toBe(
      'Enter a valid URL with scheme (e.g. https://ibl.ai)',
    );
  });

  it('rejects completely invalid input', () => {
    expect(validateWebsiteUrl('not a url')).toBe(
      'Enter a valid URL with scheme (e.g. https://ibl.ai)',
    );
  });

  it('accepts subdomain origin', () => {
    expect(validateWebsiteUrl('https://app.ibl.ai')).toBeUndefined();
  });
});
