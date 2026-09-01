import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '../carousel';

// embla-carousel reads window.matchMedia and IntersectionObserver during
// initialisation; jsdom implements neither, so provide minimal stubs before any
// carousel mounts.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  class IntersectionObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: IntersectionObserverStub,
  });
  Object.defineProperty(global, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: IntersectionObserverStub,
  });
});

function Slides() {
  return (
    <CarouselContent>
      <CarouselItem data-testid="item-1">Slide 1</CarouselItem>
      <CarouselItem data-testid="item-2">Slide 2</CarouselItem>
      <CarouselItem data-testid="item-3">Slide 3</CarouselItem>
    </CarouselContent>
  );
}

describe('Carousel components', () => {
  describe('useCarousel guard', () => {
    it('throws when CarouselContent is rendered outside a <Carousel />', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() =>
        render(
          <CarouselContent>
            <CarouselItem>orphan</CarouselItem>
          </CarouselContent>,
        ),
      ).toThrow('useCarousel must be used within a <Carousel />');

      consoleError.mockRestore();
    });
  });

  describe('Carousel rendering', () => {
    it('renders the region with carousel role description and merges className', () => {
      render(
        <Carousel className="custom-carousel" data-testid="carousel">
          <Slides />
        </Carousel>,
      );

      const region = screen.getByTestId('carousel');
      expect(region).toHaveAttribute('role', 'region');
      expect(region).toHaveAttribute('aria-roledescription', 'carousel');
      expect(region).toHaveClass('custom-carousel');
      expect(screen.getByText('Slide 1')).toBeInTheDocument();
    });

    it('renders horizontal items with the horizontal padding class', () => {
      render(
        <Carousel orientation="horizontal">
          <Slides />
        </Carousel>,
      );

      expect(screen.getByTestId('item-1')).toHaveClass('pl-4');
    });

    it('renders vertical items and content with vertical classes', () => {
      render(
        <Carousel orientation="vertical">
          <CarouselContent data-testid="content">
            <CarouselItem data-testid="v-item">Slide</CarouselItem>
          </CarouselContent>
        </Carousel>,
      );

      expect(screen.getByTestId('content')).toHaveClass('flex-col');
      expect(screen.getByTestId('v-item')).toHaveClass('pt-4');
    });
  });

  describe('setApi', () => {
    it('invokes setApi with the embla api once initialised', () => {
      const setApi = vi.fn();
      render(
        <Carousel setApi={setApi}>
          <Slides />
        </Carousel>,
      );

      expect(setApi).toHaveBeenCalled();
      const api = setApi.mock.calls.at(-1)?.[0] as CarouselApi;
      expect(api).toBeTruthy();
    });
  });

  describe('CarouselPrevious / CarouselNext', () => {
    it('renders prev/next buttons with translated sr-only labels', () => {
      render(
        <Carousel>
          <Slides />
          <CarouselPrevious data-testid="prev" />
          <CarouselNext data-testid="next" />
        </Carousel>,
      );

      expect(screen.getByText('Previous slide')).toBeInTheDocument();
      expect(screen.getByText('Next slide')).toBeInTheDocument();
      // At rest with no scroll possible, prev is disabled.
      expect(screen.getByTestId('prev')).toBeDisabled();
    });

    it('applies vertical positioning classes when orientation is vertical', () => {
      render(
        <Carousel orientation="vertical">
          <Slides />
          <CarouselPrevious data-testid="prev" />
          <CarouselNext data-testid="next" />
        </Carousel>,
      );

      expect(screen.getByTestId('prev')).toHaveClass('rotate-90');
      expect(screen.getByTestId('next')).toHaveClass('rotate-90');
    });

    it('drives scrollPrev/scrollNext via the embla api when clicked', () => {
      let api: CarouselApi;
      const onSetApi = (a: CarouselApi) => {
        api = a;
      };

      render(
        <Carousel
          setApi={onSetApi}
          opts={{ loop: true }}
          data-testid="carousel"
        >
          <Slides />
          <CarouselPrevious data-testid="prev" />
          <CarouselNext data-testid="next" />
        </Carousel>,
      );

      const scrollNextSpy = vi.spyOn(api!, 'scrollNext');
      const scrollPrevSpy = vi.spyOn(api!, 'scrollPrev');

      fireEvent.click(screen.getByTestId('next'));
      fireEvent.click(screen.getByTestId('prev'));

      expect(scrollNextSpy).toHaveBeenCalled();
      expect(scrollPrevSpy).toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('handles ArrowLeft/ArrowRight and ignores other keys', () => {
      let api: CarouselApi;
      const onSetApi = (a: CarouselApi) => {
        api = a;
      };

      render(
        <Carousel
          setApi={onSetApi}
          opts={{ loop: true }}
          data-testid="carousel"
        >
          <Slides />
        </Carousel>,
      );

      const scrollNextSpy = vi.spyOn(api!, 'scrollNext');
      const scrollPrevSpy = vi.spyOn(api!, 'scrollPrev');

      const region = screen.getByTestId('carousel');

      fireEvent.keyDown(region, { key: 'ArrowRight' });
      expect(scrollNextSpy).toHaveBeenCalled();

      fireEvent.keyDown(region, { key: 'ArrowLeft' });
      expect(scrollPrevSpy).toHaveBeenCalled();

      scrollNextSpy.mockClear();
      scrollPrevSpy.mockClear();

      fireEvent.keyDown(region, { key: 'Enter' });
      expect(scrollNextSpy).not.toHaveBeenCalled();
      expect(scrollPrevSpy).not.toHaveBeenCalled();
    });
  });
});
