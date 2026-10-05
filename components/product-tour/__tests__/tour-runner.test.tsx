import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

let capturedProps: Record<string, any> | null = null;
vi.mock('react-joyride', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-joyride')>()),
  Joyride: (props: Record<string, any>) => {
    capturedProps = props;
    return <div data-testid="joyride" data-run={String(props.run)} />;
  },
}));

import { EVENTS, STATUS } from 'react-joyride';
import { TourRunner, TOUR_OPTIONS } from '../tour-runner';
import { TourTooltip } from '../tour-tooltip';

const steps = [
  { id: 'profile', target: '[data-tour="profile"]', content: 'Profile' },
];

const event = (type: string, status: string) =>
  ({ type, status, index: 0, step: steps[0] }) as any;

describe('TourRunner', () => {
  beforeEach(() => {
    capturedProps = null;
  });

  it('configures joyride as a continuous, beacon-less tour with the custom tooltip', () => {
    render(<TourRunner steps={steps} run onEnd={vi.fn()} />);
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'true');
    expect(capturedProps).toMatchObject({
      continuous: true,
      steps,
      options: TOUR_OPTIONS,
    });
    expect(capturedProps?.tooltipComponent).toBe(TourTooltip);
    expect(TOUR_OPTIONS).toMatchObject({
      skipBeacon: true,
      skipScroll: true,
      blockTargetInteraction: true,
      closeButtonAction: 'skip',
      overlayClickAction: false,
      dismissKeyAction: false,
    });
  });

  it('names the buttons from the productTour messages', () => {
    render(<TourRunner steps={steps} run onEnd={vi.fn()} />);
    expect(capturedProps?.locale).toEqual({
      back: 'Back',
      close: 'Close tour',
      last: 'Done',
      next: 'Next',
      skip: 'Skip tour',
    });
  });

  it('passes run=false through', () => {
    render(<TourRunner steps={steps} run={false} onEnd={vi.fn()} />);
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'false');
  });

  it('reports a finished tour', () => {
    const onEnd = vi.fn();
    render(<TourRunner steps={steps} run onEnd={onEnd} />);
    capturedProps?.onEvent(event(EVENTS.TOUR_END, STATUS.FINISHED));
    expect(onEnd).toHaveBeenCalledWith('finished');
  });

  it('reports a skipped tour (close button, ESC, or Skip)', () => {
    const onEnd = vi.fn();
    render(<TourRunner steps={steps} run onEnd={onEnd} />);
    capturedProps?.onEvent(event(EVENTS.TOUR_END, STATUS.SKIPPED));
    expect(onEnd).toHaveBeenCalledWith('skipped');
  });

  it('ignores every other event', () => {
    const onEnd = vi.fn();
    render(<TourRunner steps={steps} run onEnd={onEnd} />);
    capturedProps?.onEvent(event(EVENTS.STEP_AFTER, STATUS.RUNNING));
    capturedProps?.onEvent(event(EVENTS.TARGET_NOT_FOUND, STATUS.RUNNING));
    expect(onEnd).not.toHaveBeenCalled();
  });
});
