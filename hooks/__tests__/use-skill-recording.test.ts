import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RECORD_START,
  RECORD_STOP,
  useSkillRecording,
} from '@/hooks/use-skill-recording';

let posted: unknown[] = [];

const fromPanel = (data: unknown) =>
  window.dispatchEvent(
    new MessageEvent('message', { data, source: window.parent }),
  );

beforeEach(() => {
  posted = [];
  Object.defineProperty(window, 'parent', {
    configurable: true,
    writable: true,
    value: { postMessage: (message: unknown) => posted.push(message) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('starting and stopping', () => {
  it('asks the panel to record, and says so at once', () => {
    const { result } = renderHook(() => useSkillRecording());

    act(() => result.current.start());

    // The row has to answer the click rather than wait for a round trip.
    expect(result.current.isRecording).toBe(true);
    expect(posted).toEqual([{ type: RECORD_START }]);
  });

  it('asks the panel to stop only while something is recording', () => {
    const { result } = renderHook(() => useSkillRecording());

    act(() => result.current.stop());
    expect(posted).toEqual([]);

    act(() => result.current.start());
    act(() => result.current.stop());
    expect(posted).toContainEqual({ type: RECORD_STOP });
  });

  it('counts the steps the panel reports while recording', () => {
    const { result } = renderHook(() => useSkillRecording());
    act(() => result.current.start());

    act(() => fromPanel({ type: 'recording', steps: 3 }));

    expect(result.current.count).toBe(3);
  });

  it('hands over the finished recording', () => {
    const { result } = renderHook(() => useSkillRecording());
    act(() => result.current.start());

    act(() =>
      fromPanel({
        type: 'recorded',
        steps: [
          {
            tool: 'click',
            target: { role: 'button', name: 'Export' },
            url: 'https://acme.com',
          },
        ],
      }),
    );

    expect(result.current.isRecording).toBe(false);
    expect(result.current.steps).toHaveLength(1);
  });

  it('puts the row back when the panel could not record', () => {
    const { result } = renderHook(() => useSkillRecording());
    act(() => result.current.start());

    act(() =>
      fromPanel({ type: 'error', message: 'This page cannot be used' }),
    );

    // Otherwise the row says it is recording a page nothing is watching.
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBe('This page cannot be used');
  });
});

describe('what it ignores', () => {
  it('ignores frames from anywhere but the panel', () => {
    const { result } = renderHook(() => useSkillRecording());

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'recorded', steps: [{}] },
        source: {} as Window,
      }),
    );

    expect(result.current.steps).toBeNull();
  });

  it('ignores anything that is not a frame', () => {
    const { result } = renderHook(() => useSkillRecording());

    act(() => fromPanel('hello'));
    act(() => fromPanel(null));

    expect(result.current.isRecording).toBe(false);
  });
});

describe('after review', () => {
  it('forgets the recording once it has been dealt with', () => {
    const { result } = renderHook(() => useSkillRecording());
    act(() => result.current.start());
    act(() => fromPanel({ type: 'recorded', steps: [] }));

    act(() => result.current.clear());

    expect(result.current.steps).toBeNull();
  });
});
