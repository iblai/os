import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

const ProfilePageModule = await import('../page');
const ProfilePage = ProfilePageModule.default;

describe('profile page', () => {
  it('should export dynamic config', () => {
    expect(ProfilePageModule.dynamic).toBe('force-dynamic');
  });

  it('should render div container', () => {
    const { container } = render(<ProfilePage />);
    expect(container.querySelector('.p-6')).toBeInTheDocument();
  });
});
