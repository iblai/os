import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { RubricEditor, createEmptyRubricItem } from '../rubric-editor';
import type { CriterionDraft } from '../hooks/use-grader-configuration';

function makeItem(overrides: Partial<CriterionDraft> = {}): CriterionDraft {
  return {
    name: 'Clarity',
    criteria: 'Explanation is clear',
    points: 30,
    ...overrides,
  };
}

describe('RubricEditor', () => {
  it('shows the empty state when value is an empty array', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[]} onChange={onChange} />);
    expect(screen.getByTestId('rubric-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('rubric-item-count')).toHaveTextContent(
      '0 items',
    );
  });

  it('renders a list of items with name, criteria and points inputs', () => {
    const items: CriterionDraft[] = [
      makeItem({ name: 'A' }),
      makeItem({ name: 'B' }),
    ];
    render(<RubricEditor value={items} onChange={vi.fn()} />);
    expect(screen.getByTestId('rubric-items-list')).toBeInTheDocument();
    expect(screen.getByTestId('rubric-item-name-0')).toHaveValue('A');
    expect(screen.getByTestId('rubric-item-name-1')).toHaveValue('B');
    expect(screen.getByTestId('rubric-item-count')).toHaveTextContent(
      '2 items',
    );
  });

  it('shows singular label when there is exactly one item', () => {
    render(<RubricEditor value={[makeItem()]} onChange={vi.fn()} />);
    expect(screen.getByTestId('rubric-item-count')).toHaveTextContent('1 item');
  });

  it('appends a new item when "Add rubric item" is clicked', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('rubric-add-item'));
    expect(onChange).toHaveBeenCalledWith([createEmptyRubricItem()]);
  });

  it('removes an item via the trash button', () => {
    const onChange = vi.fn();
    const items = [makeItem({ name: 'X' }), makeItem({ name: 'Y' })];
    render(<RubricEditor value={items} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('rubric-item-remove-0'));
    expect(onChange).toHaveBeenCalledWith([items[1]]);
  });

  it('updates the name when typing', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[makeItem()]} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('rubric-item-name-0'), {
      target: { value: 'Updated' },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Updated' }),
    ]);
  });

  it('preserves untouched items when updating one in a multi-item rubric', () => {
    const onChange = vi.fn();
    const items = [makeItem({ name: 'First' }), makeItem({ name: 'Second' })];
    render(<RubricEditor value={items} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('rubric-item-name-1'), {
      target: { value: 'Updated second' },
    });
    expect(onChange).toHaveBeenCalledWith([
      items[0],
      expect.objectContaining({ name: 'Updated second' }),
    ]);
  });

  it('updates the criteria text when typing', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[makeItem()]} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('rubric-item-criteria-0'), {
      target: { value: 'Updated criteria' },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ criteria: 'Updated criteria' }),
    ]);
  });

  it('updates points to a numeric value', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[makeItem()]} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('rubric-item-points-0'), {
      target: { value: '12.5' },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ points: 12.5 }),
    ]);
  });

  it('treats empty points input as 0 (cleared field)', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[makeItem()]} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('rubric-item-points-0'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ points: 0 }),
    ]);
  });

  it('coerces the points field to 0 when a NaN slips through', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[makeItem()]} onChange={onChange} />);
    const input = screen.getByTestId(
      'rubric-item-points-0',
    ) as HTMLInputElement;
    // Patch the input prototype so React reads back the "abc" value we set
    // (jsdom + React normally strip non-numeric values from number inputs,
    // hiding the Number.isNaN branch in the handler). We restore the
    // descriptor afterwards so the rest of the suite is unaffected.
    const proto = Object.getPrototypeOf(input);
    const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return 'abc';
      },
      set() {},
    });
    try {
      fireEvent.change(input);
      expect(onChange).toHaveBeenCalled();
      const lastCallArgs = onChange.mock.calls.at(-1)![0] as CriterionDraft[];
      expect(lastCallArgs[0].points).toBe(0);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(proto, 'value', originalDescriptor);
      }
    }
  });

  it('disables inputs when disabled is true', () => {
    render(<RubricEditor value={[makeItem()]} onChange={vi.fn()} disabled />);
    expect(screen.getByTestId('rubric-item-name-0')).toBeDisabled();
    expect(screen.getByTestId('rubric-item-points-0')).toBeDisabled();
    expect(screen.getByTestId('rubric-item-remove-0')).toBeDisabled();
    expect(screen.getByTestId('rubric-add-item')).toBeDisabled();
  });

  it('uses the criterion id as a stable key when provided', () => {
    const items: CriterionDraft[] = [
      makeItem({ id: 1 }),
      makeItem({ id: 2, name: 'B' }),
    ];
    render(<RubricEditor value={items} onChange={vi.fn()} />);
    expect(screen.getByTestId('rubric-item-name-0')).toBeInTheDocument();
    expect(screen.getByTestId('rubric-item-name-1')).toBeInTheDocument();
  });

  it('createEmptyRubricItem returns a fresh item with default points of 1', () => {
    const a = createEmptyRubricItem();
    const b = createEmptyRubricItem();
    expect(a).not.toBe(b);
    expect(a).toEqual({ name: '', criteria: '', points: 1 });
  });
});
