import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDispatch } from 'react-redux';
import { StoreProvider } from '../store-provider';

// Mock the store module
vi.mock('@/store', () => ({
  store: {
    getState: () => ({}),
    dispatch: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    replaceReducer: vi.fn(),
    [Symbol.observable]: vi.fn(),
  },
}));

describe('StoreProvider', () => {
  it('renders without crashing', () => {
    render(
      <StoreProvider>
        <div data-testid="child">Test Content</div>
      </StoreProvider>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    render(
      <StoreProvider>
        <span>Hello World</span>
      </StoreProvider>,
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <StoreProvider>
        <div>Child 1</div>
        <div>Child 2</div>
      </StoreProvider>,
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('provides Redux store context to children', () => {
    // Test component that uses Redux dispatch hook
    function TestComponent() {
      // If Provider is working, useDispatch won't throw
      const dispatch = useDispatch();

      return (
        <div data-testid="connected">
          {typeof dispatch === 'function'
            ? 'dispatch available'
            : 'no dispatch'}
        </div>
      );
    }

    render(
      <StoreProvider>
        <TestComponent />
      </StoreProvider>,
    );

    expect(screen.getByTestId('connected')).toHaveTextContent(
      'dispatch available',
    );
  });

  it('handles null children', () => {
    const { container } = render(<StoreProvider>{null}</StoreProvider>);
    expect(container).toBeTruthy();
  });

  it('handles undefined children', () => {
    const { container } = render(<StoreProvider>{undefined}</StoreProvider>);
    expect(container).toBeTruthy();
  });

  it('handles fragment children', () => {
    render(
      <StoreProvider>
        <>
          <span>Fragment Child 1</span>
          <span>Fragment Child 2</span>
        </>
      </StoreProvider>,
    );

    expect(screen.getByText('Fragment Child 1')).toBeInTheDocument();
    expect(screen.getByText('Fragment Child 2')).toBeInTheDocument();
  });

  it('handles deeply nested children', () => {
    render(
      <StoreProvider>
        <div>
          <div>
            <div>
              <span data-testid="deeply-nested">Deep Content</span>
            </div>
          </div>
        </div>
      </StoreProvider>,
    );

    expect(screen.getByTestId('deeply-nested')).toHaveTextContent(
      'Deep Content',
    );
  });
});
