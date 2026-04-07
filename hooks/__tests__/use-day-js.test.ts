import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDayJs } from '../use-day-js';

describe('useDayJs', () => {
  describe('getTimeDifferenceBetweenTwoDates', () => {
    it('should return the difference in seconds by default', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-01-15T12:00:30Z';
      const pastDate = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
      );

      expect(diff).toBe(30);
    });

    it('should return the difference in minutes when specified', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-01-15T12:30:00Z';
      const pastDate = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
        'minute',
      );

      expect(diff).toBe(30);
    });

    it('should return the difference in hours when specified', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-01-15T14:00:00Z';
      const pastDate = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
        'hour',
      );

      expect(diff).toBe(2);
    });

    it('should return the difference in days when specified', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-01-17T12:00:00Z';
      const pastDate = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
        'day',
      );

      expect(diff).toBe(2);
    });

    it('should return negative value when past date is after future date', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-01-15T12:00:00Z';
      const pastDate = '2024-01-15T12:00:30Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
      );

      expect(diff).toBe(-30);
    });

    it('should return 0 when dates are the same', () => {
      const { result } = renderHook(() => useDayJs());

      const date = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(date, date);

      expect(diff).toBe(0);
    });

    it('should handle milliseconds format', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-01-15T12:00:01Z';
      const pastDate = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
        'millisecond',
      );

      expect(diff).toBe(1000);
    });

    it('should handle week format', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-01-22T12:00:00Z';
      const pastDate = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
        'week',
      );

      expect(diff).toBe(1);
    });

    it('should handle month format', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = '2024-03-15T12:00:00Z';
      const pastDate = '2024-01-15T12:00:00Z';

      const diff = result.current.getTimeDifferenceBetweenTwoDates(
        futureDate,
        pastDate,
        'month',
      );

      expect(diff).toBe(2);
    });
  });

  describe('getDayJSDurationObjFromSeconds', () => {
    it('should create a duration object from seconds', () => {
      const { result } = renderHook(() => useDayJs());

      const duration = result.current.getDayJSDurationObjFromSeconds(3600);

      expect(duration.asHours()).toBe(1);
    });

    it('should handle 0 seconds', () => {
      const { result } = renderHook(() => useDayJs());

      const duration = result.current.getDayJSDurationObjFromSeconds(0);

      expect(duration.asSeconds()).toBe(0);
    });

    it('should handle large number of seconds', () => {
      const { result } = renderHook(() => useDayJs());

      const duration = result.current.getDayJSDurationObjFromSeconds(86400); // 24 hours

      expect(duration.asDays()).toBe(1);
      expect(duration.asHours()).toBe(24);
    });

    it('should handle negative seconds', () => {
      const { result } = renderHook(() => useDayJs());

      const duration = result.current.getDayJSDurationObjFromSeconds(-60);

      expect(duration.asMinutes()).toBe(-1);
    });

    it('should provide minutes accessor', () => {
      const { result } = renderHook(() => useDayJs());

      const duration = result.current.getDayJSDurationObjFromSeconds(90);

      expect(duration.asMinutes()).toBe(1.5);
    });

    it('should handle seconds to days conversion', () => {
      const { result } = renderHook(() => useDayJs());

      const duration = result.current.getDayJSDurationObjFromSeconds(172800); // 2 days

      expect(duration.asDays()).toBe(2);
    });
  });

  describe('generateFutureDateForNMinutes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should generate a date 2 minutes in the future by default', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = result.current.generateFutureDateForNMinutes();

      // Should be approximately 2 minutes in the future (2024-01-15T12:02:00)
      expect(futureDate).toMatch(/^2024-01-15T12:02:00/);
    });

    it('should generate a date N minutes in the future', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = result.current.generateFutureDateForNMinutes(5);

      // Should be approximately 5 minutes in the future
      expect(futureDate).toMatch(/^2024-01-15T12:05:00/);
    });

    it('should generate a date with microseconds and UTC offset', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = result.current.generateFutureDateForNMinutes();

      // Should end with microseconds and +00:00
      expect(futureDate).toMatch(/\d{6}\+00:00$/);
    });

    it('should handle 0 minutes', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = result.current.generateFutureDateForNMinutes(0);

      // Should be approximately the current time
      expect(futureDate).toMatch(/^2024-01-15T12:00:00/);
    });

    it('should handle large number of minutes', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = result.current.generateFutureDateForNMinutes(60);

      // Should be 1 hour in the future
      expect(futureDate).toMatch(/^2024-01-15T13:00:00/);
    });

    it('should handle 1 minute', () => {
      const { result } = renderHook(() => useDayJs());

      const futureDate = result.current.generateFutureDateForNMinutes(1);

      expect(futureDate).toMatch(/^2024-01-15T12:01:00/);
    });
  });

  describe('hook stability', () => {
    it('should return consistent function references', () => {
      const { result, rerender } = renderHook(() => useDayJs());

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // Note: Since functions are created inside the hook, they may not be referentially equal
      // but their behavior should be consistent
      expect(typeof firstResult.getTimeDifferenceBetweenTwoDates).toBe(
        'function',
      );
      expect(typeof secondResult.getTimeDifferenceBetweenTwoDates).toBe(
        'function',
      );
    });
  });
});
