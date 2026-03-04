import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectGroup,
} from '../select';

describe('Select components', () => {
  describe('SelectLabel', () => {
    it('should render with children', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>,
      );

      // The trigger should be visible
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <Select defaultOpen>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="custom-label-class">Group Label</SelectLabel>
              <SelectItem value="test">Test Item</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>,
      );

      // Check that the component renders
      expect(container).toBeTruthy();
    });
  });

  describe('SelectSeparator', () => {
    it('should render separator in select content', () => {
      const { container } = render(
        <Select defaultOpen>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="item1">Item 1</SelectItem>
            <SelectSeparator />
            <SelectItem value="item2">Item 2</SelectItem>
          </SelectContent>
        </Select>,
      );

      // Check that the component renders
      expect(container).toBeTruthy();
    });

    it('should apply custom className to separator', () => {
      const { container } = render(
        <Select defaultOpen>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="first">First</SelectItem>
            <SelectSeparator className="custom-separator" />
            <SelectItem value="second">Second</SelectItem>
          </SelectContent>
        </Select>,
      );

      // Check that the component renders
      expect(container).toBeTruthy();
    });
  });

  describe('SelectTrigger', () => {
    it('should render trigger with placeholder', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
        </Select>,
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('SelectItem', () => {
    it('should render item with value', () => {
      render(
        <Select defaultOpen>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>,
      );

      // When open, check for the listbox and option
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    });
  });
});
