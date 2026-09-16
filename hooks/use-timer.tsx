// useTimer hook (same as above)
import { useState, useRef, useEffect, useCallback } from 'react';

export function useTimer() {
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = now.getTime() - startTimeRef.current!.getTime();
        setTime(elapsed);
      }, 10);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!isRunningRef.current) {
      const now = new Date();
      isRunningRef.current = true;
      setStartTime(now);
      setIsRunning(true);
      startTimeRef.current = now;
    }
  }, []);

  const stop = useCallback(() => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      setIsRunning(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, []);

  return {
    startTime,
    time,
    isRunning,
    start,
    stop,
  };
}
