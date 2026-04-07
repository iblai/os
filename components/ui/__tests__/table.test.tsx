import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '../table';

describe('Table components', () => {
  describe('Table', () => {
    it('should render table with children', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <Table className="custom-table">
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByRole('table')).toHaveClass('custom-table');
    });
  });

  describe('TableHeader', () => {
    it('should render thead with children', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByRole('columnheader')).toHaveTextContent('Header');
    });
  });

  describe('TableFooter', () => {
    it('should render tfoot with children', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter data-testid="table-footer">
            <TableRow>
              <TableCell>Footer content</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      expect(screen.getByTestId('table-footer')).toBeInTheDocument();
      expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('should apply custom className to footer', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter className="custom-footer" data-testid="table-footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      expect(screen.getByTestId('table-footer')).toHaveClass('custom-footer');
    });
  });

  describe('TableCaption', () => {
    it('should render caption with text', () => {
      render(
        <Table>
          <TableCaption>Table description</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText('Table description')).toBeInTheDocument();
    });

    it('should apply custom className to caption', () => {
      render(
        <Table>
          <TableCaption className="custom-caption" data-testid="caption">
            Caption text
          </TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByTestId('caption')).toHaveClass('custom-caption');
    });
  });

  describe('TableRow', () => {
    it('should render row with cells', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell 1</TableCell>
              <TableCell>Cell 2</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByRole('row')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 2')).toBeInTheDocument();
    });
  });

  describe('TableHead', () => {
    it('should render header cell', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column Header</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByRole('columnheader')).toHaveTextContent(
        'Column Header',
      );
    });
  });

  describe('TableCell', () => {
    it('should render cell with content', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByRole('cell')).toHaveTextContent('Cell content');
    });
  });
});
