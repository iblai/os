import { describe, it, expect } from 'vitest';

const PageModule = await import('../page');
const Page = PageModule.default;

describe('projects page', () => {
  it('should export dynamic config', () => {
    expect(PageModule.dynamic).toBe('force-dynamic');
  });

  it('should export page component', () => {
    expect(Page).toBeDefined();
    expect(typeof Page).toBe('function');
  });
});
