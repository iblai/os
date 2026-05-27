import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Version } from '../version';

describe('Version component', () => {
  const defaultProps = {
    appName: 'Mentor',
    appVersion: '1.0.0',
    poweredBy: <span>IBL AI</span>,
  };

  it('renders the app name', () => {
    render(<Version {...defaultProps} />);
    expect(screen.getByText(/ibl\.ai Mentor/)).toBeInTheDocument();
  });

  it('renders the version badge', () => {
    render(<Version {...defaultProps} />);
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('renders the powered by section', () => {
    render(<Version {...defaultProps} />);
    expect(screen.getByText('IBL AI')).toBeInTheDocument();
    expect(screen.getByText(/Powered by/)).toBeInTheDocument();
    expect(screen.getByText(/in New York/)).toBeInTheDocument();
  });

  it('renders the current version label', () => {
    render(<Version {...defaultProps} />);
    expect(screen.getByText('Current Version')).toBeInTheDocument();
  });

  it('renders with different props', () => {
    render(
      <Version
        appName="Skills"
        appVersion="2.5.0"
        poweredBy={<a href="#">iBL</a>}
      />,
    );
    expect(screen.getByText(/ibl\.ai Skills/)).toBeInTheDocument();
    expect(screen.getByText('2.5.0')).toBeInTheDocument();
    expect(screen.getByText('iBL')).toBeInTheDocument();
  });
});
