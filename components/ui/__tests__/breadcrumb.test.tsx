import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '../breadcrumb';

describe('Breadcrumb components', () => {
  describe('Breadcrumb', () => {
    it('renders a nav with the translated aria-label and forwards ref', () => {
      const ref = React.createRef<HTMLElement>();
      render(
        <Breadcrumb ref={ref} data-testid="breadcrumb">
          <span>crumbs</span>
        </Breadcrumb>,
      );

      const nav = screen.getByTestId('breadcrumb');
      expect(nav.tagName).toBe('NAV');
      expect(nav).toHaveAttribute('aria-label', 'breadcrumb');
      expect(nav).toHaveTextContent('crumbs');
      expect(ref.current).toBe(nav);
    });
  });

  describe('BreadcrumbList', () => {
    it('renders an ol, merges className and forwards ref', () => {
      const ref = React.createRef<HTMLOListElement>();
      render(
        <BreadcrumbList ref={ref} className="custom-list" data-testid="list">
          item
        </BreadcrumbList>,
      );

      const list = screen.getByTestId('list');
      expect(list.tagName).toBe('OL');
      expect(list).toHaveClass('custom-list');
      expect(ref.current).toBe(list);
    });
  });

  describe('BreadcrumbItem', () => {
    it('renders an li, merges className and forwards ref', () => {
      const ref = React.createRef<HTMLLIElement>();
      render(
        <BreadcrumbItem ref={ref} className="custom-item" data-testid="item">
          page
        </BreadcrumbItem>,
      );

      const item = screen.getByTestId('item');
      expect(item.tagName).toBe('LI');
      expect(item).toHaveClass('custom-item');
      expect(ref.current).toBe(item);
    });
  });

  describe('BreadcrumbLink', () => {
    it('renders an anchor by default', () => {
      const ref = React.createRef<HTMLAnchorElement>();
      render(
        <BreadcrumbLink
          ref={ref}
          href="/home"
          className="custom-link"
          data-testid="link"
        >
          Home
        </BreadcrumbLink>,
      );

      const link = screen.getByTestId('link');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/home');
      expect(link).toHaveClass('custom-link');
      expect(ref.current).toBe(link);
    });

    it('renders the child element when asChild is set', () => {
      render(
        <BreadcrumbLink asChild>
          <button data-testid="slot-link">Click</button>
        </BreadcrumbLink>,
      );

      const el = screen.getByTestId('slot-link');
      expect(el.tagName).toBe('BUTTON');
      expect(el).toHaveClass('transition-colors');
    });
  });

  describe('BreadcrumbPage', () => {
    it('renders a span with current-page semantics', () => {
      const ref = React.createRef<HTMLSpanElement>();
      render(
        <BreadcrumbPage ref={ref} className="custom-page" data-testid="page">
          Current
        </BreadcrumbPage>,
      );

      const page = screen.getByTestId('page');
      expect(page.tagName).toBe('SPAN');
      expect(page).toHaveAttribute('role', 'link');
      expect(page).toHaveAttribute('aria-disabled', 'true');
      expect(page).toHaveAttribute('aria-current', 'page');
      expect(page).toHaveClass('custom-page');
      expect(ref.current).toBe(page);
    });
  });

  describe('BreadcrumbSeparator', () => {
    it('renders the default ChevronRight icon when no children given', () => {
      render(<BreadcrumbSeparator data-testid="separator" />);

      const separator = screen.getByTestId('separator');
      expect(separator.tagName).toBe('LI');
      expect(separator).toHaveAttribute('role', 'presentation');
      expect(separator).toHaveAttribute('aria-hidden', 'true');
      // The default icon renders an svg.
      expect(separator.querySelector('svg')).toBeInTheDocument();
    });

    it('renders custom children and merges className', () => {
      render(
        <BreadcrumbSeparator className="custom-sep" data-testid="separator">
          <span data-testid="custom-child">/</span>
        </BreadcrumbSeparator>,
      );

      const separator = screen.getByTestId('separator');
      expect(separator).toHaveClass('custom-sep');
      expect(screen.getByTestId('custom-child')).toHaveTextContent('/');
    });
  });

  describe('BreadcrumbEllipsis', () => {
    it('renders the ellipsis with sr-only translated text', () => {
      render(
        <BreadcrumbEllipsis
          className="custom-ellipsis"
          data-testid="ellipsis"
        />,
      );

      const ellipsis = screen.getByTestId('ellipsis');
      expect(ellipsis.tagName).toBe('SPAN');
      expect(ellipsis).toHaveAttribute('role', 'presentation');
      expect(ellipsis).toHaveAttribute('aria-hidden', 'true');
      expect(ellipsis).toHaveClass('custom-ellipsis');
      expect(ellipsis.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText('More')).toBeInTheDocument();
    });
  });

  describe('Composed Breadcrumb', () => {
    it('renders a full breadcrumb trail', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Details</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });
});
