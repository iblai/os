import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent } from '../card';

describe('Card components', () => {
  describe('Card', () => {
    it('should render with children', () => {
      render(<Card data-testid="card">Card content</Card>);
      expect(screen.getByTestId('card')).toHaveTextContent('Card content');
    });

    it('should apply custom className', () => {
      render(
        <Card className="custom-class" data-testid="card">
          Content
        </Card>,
      );
      expect(screen.getByTestId('card')).toHaveClass('custom-class');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>Content</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardHeader', () => {
    it('should render with children', () => {
      render(<CardHeader data-testid="card-header">Header content</CardHeader>);
      expect(screen.getByTestId('card-header')).toHaveTextContent(
        'Header content',
      );
    });

    it('should apply custom className', () => {
      render(
        <CardHeader className="custom-header-class" data-testid="card-header">
          Header
        </CardHeader>,
      );
      expect(screen.getByTestId('card-header')).toHaveClass(
        'custom-header-class',
      );
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardHeader ref={ref}>Header</CardHeader>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardTitle', () => {
    it('should render with children', () => {
      render(<CardTitle data-testid="card-title">Title text</CardTitle>);
      expect(screen.getByTestId('card-title')).toHaveTextContent('Title text');
    });

    it('should apply custom className', () => {
      render(
        <CardTitle className="custom-title-class" data-testid="card-title">
          Title
        </CardTitle>,
      );
      expect(screen.getByTestId('card-title')).toHaveClass(
        'custom-title-class',
      );
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<CardTitle ref={ref}>Title</CardTitle>);
      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
    });
  });

  describe('CardContent', () => {
    it('should render with children', () => {
      render(
        <CardContent data-testid="card-content">Content here</CardContent>,
      );
      expect(screen.getByTestId('card-content')).toHaveTextContent(
        'Content here',
      );
    });

    it('should apply custom className', () => {
      render(
        <CardContent
          className="custom-content-class"
          data-testid="card-content"
        >
          Content
        </CardContent>,
      );
      expect(screen.getByTestId('card-content')).toHaveClass(
        'custom-content-class',
      );
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CardContent ref={ref}>Content</CardContent>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Composed Card', () => {
    it('should render full card with all components', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader data-testid="full-card-header">
            <CardTitle data-testid="full-card-title">My Card Title</CardTitle>
          </CardHeader>
          <CardContent data-testid="full-card-content">
            Card body content here
          </CardContent>
        </Card>,
      );

      expect(screen.getByTestId('full-card')).toBeInTheDocument();
      expect(screen.getByTestId('full-card-header')).toBeInTheDocument();
      expect(screen.getByTestId('full-card-title')).toHaveTextContent(
        'My Card Title',
      );
      expect(screen.getByTestId('full-card-content')).toHaveTextContent(
        'Card body content here',
      );
    });
  });
});
