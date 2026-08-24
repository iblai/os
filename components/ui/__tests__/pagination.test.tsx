import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '../pagination';

describe('Pagination components', () => {
  describe('Pagination', () => {
    it('renders a nav with translated aria-label and merges className', () => {
      render(
        <Pagination className="custom-nav" data-testid="pagination">
          content
        </Pagination>,
      );

      const nav = screen.getByTestId('pagination');
      expect(nav.tagName).toBe('NAV');
      expect(nav).toHaveAttribute('role', 'navigation');
      expect(nav).toHaveAttribute('aria-label', 'pagination');
      expect(nav).toHaveClass('custom-nav');
    });
  });

  describe('PaginationContent', () => {
    it('renders a ul, merges className and forwards ref', () => {
      const ref = React.createRef<HTMLUListElement>();
      render(
        <PaginationContent
          ref={ref}
          className="custom-content"
          data-testid="content"
        >
          items
        </PaginationContent>,
      );

      const content = screen.getByTestId('content');
      expect(content.tagName).toBe('UL');
      expect(content).toHaveClass('custom-content');
      expect(ref.current).toBe(content);
    });
  });

  describe('PaginationItem', () => {
    it('renders an li, merges className and forwards ref', () => {
      const ref = React.createRef<HTMLLIElement>();
      render(
        <PaginationItem ref={ref} className="custom-item" data-testid="item">
          item
        </PaginationItem>,
      );

      const item = screen.getByTestId('item');
      expect(item.tagName).toBe('LI');
      expect(item).toHaveClass('custom-item');
      expect(ref.current).toBe(item);
    });
  });

  describe('PaginationLink', () => {
    it('renders an inactive link without aria-current', () => {
      render(
        <PaginationLink href="#1" className="custom-link" data-testid="link">
          1
        </PaginationLink>,
      );

      const link = screen.getByTestId('link');
      expect(link.tagName).toBe('A');
      expect(link).not.toHaveAttribute('aria-current');
      expect(link).toHaveClass('custom-link');
      expect(link).toHaveAttribute('href', '#1');
    });

    it('marks the active link with aria-current=page', () => {
      render(
        <PaginationLink href="#2" isActive data-testid="active-link">
          2
        </PaginationLink>,
      );

      expect(screen.getByTestId('active-link')).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('honours a custom size prop', () => {
      render(
        <PaginationLink href="#3" size="default" data-testid="sized-link">
          3
        </PaginationLink>,
      );

      expect(screen.getByTestId('sized-link')).toBeInTheDocument();
    });
  });

  describe('PaginationPrevious', () => {
    it('renders the previous control with translated label and text', () => {
      render(
        <PaginationPrevious
          href="#prev"
          className="custom-prev"
          data-testid="prev"
        />,
      );

      const prev = screen.getByTestId('prev');
      expect(prev).toHaveAttribute('aria-label', 'Go to previous page');
      expect(prev).toHaveClass('custom-prev');
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
  });

  describe('PaginationNext', () => {
    it('renders the next control with translated label and text', () => {
      render(
        <PaginationNext
          href="#next"
          className="custom-next"
          data-testid="next"
        />,
      );

      const next = screen.getByTestId('next');
      expect(next).toHaveAttribute('aria-label', 'Go to next page');
      expect(next).toHaveClass('custom-next');
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  describe('PaginationEllipsis', () => {
    it('renders the ellipsis with sr-only translated text', () => {
      render(
        <PaginationEllipsis
          className="custom-ellipsis"
          data-testid="ellipsis"
        />,
      );

      const ellipsis = screen.getByTestId('ellipsis');
      expect(ellipsis.tagName).toBe('SPAN');
      expect(ellipsis).toHaveAttribute('aria-hidden');
      expect(ellipsis).toHaveClass('custom-ellipsis');
      expect(ellipsis.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText('More pages')).toBeInTheDocument();
    });
  });

  describe('Composed Pagination', () => {
    it('renders a full pagination bar', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#prev" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#1">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#2" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#next" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>,
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });
});
