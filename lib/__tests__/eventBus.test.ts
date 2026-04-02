import { describe, it, expect, vi } from 'vitest';
import eventBus, { RemoteEvents } from '../eventBus';

describe('lib/eventBus', () => {
  describe('RemoteEvents', () => {
    it('should have newChat event', () => {
      expect(RemoteEvents.newChat).toBe('MENTOR:NEW_CHAT');
    });

    it('should have stopChatGenerating event', () => {
      expect(RemoteEvents.stopChatGenerating).toBe(
        'MENTOR:STOP_CHAT_GENERATING',
      );
    });

    it('should have exactly 2 remote events defined', () => {
      expect(Object.keys(RemoteEvents)).toHaveLength(2);
    });
  });

  describe('eventBus instance', () => {
    it('should be defined', () => {
      expect(eventBus).toBeDefined();
    });

    it('should have on method', () => {
      expect(eventBus.on).toBeDefined();
      expect(typeof eventBus.on).toBe('function');
    });

    it('should have off method', () => {
      expect(eventBus.off).toBeDefined();
      expect(typeof eventBus.off).toBe('function');
    });

    it('should have emit method', () => {
      expect(eventBus.emit).toBeDefined();
      expect(typeof eventBus.emit).toBe('function');
    });

    it('should emit and receive events', () => {
      const handler = vi.fn();
      const testEvent = 'TEST_EVENT';
      const testData = { test: 'data' };

      eventBus.on(testEvent, handler);
      eventBus.emit(testEvent, testData);

      expect(handler).toHaveBeenCalledWith(testData);
      expect(handler).toHaveBeenCalledTimes(1);

      eventBus.off(testEvent, handler);
    });

    it('should remove event listeners', () => {
      const handler = vi.fn();
      const testEvent = 'TEST_EVENT_2';

      eventBus.on(testEvent, handler);
      eventBus.off(testEvent, handler);
      eventBus.emit(testEvent, {});

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
