import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ saveAs: vi.fn(), invoke: vi.fn() }));

vi.mock('file-saver', () => ({ saveAs: mocks.saveAs }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

import { saveFile } from '../save-file';

// jsdom's Blob has no arrayBuffer(); the WebViews the app runs in do.
const blob = () =>
  Object.assign(new Blob(['PK'], { type: 'application/x-test' }), {
    arrayBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer,
  });

describe('saveFile', () => {
  beforeEach(() => {
    mocks.saveAs.mockReset();
    mocks.invoke.mockReset();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('downloads straight away in the browser, without waiting', () => {
    const file = blob();
    const result = saveFile(file, 'chat-Ada-2025-01-01.xlsx');
    expect(result).toBeUndefined();
    expect(mocks.saveAs).toHaveBeenCalledWith(file, 'chat-Ada-2025-01-01.xlsx');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  describe('in the desktop app', () => {
    beforeEach(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    });

    it('hands the bytes to the native save dialog', async () => {
      mocks.invoke.mockResolvedValue(true);
      await saveFile(blob(), 'chat-Ada-2025-01-01.xlsx');
      expect(mocks.invoke).toHaveBeenCalledWith('save_chat_file', {
        fileName: 'chat-Ada-2025-01-01.xlsx',
        contents: [80, 75, 3, 4],
      });
      expect(mocks.saveAs).not.toHaveBeenCalled();
    });

    it('does nothing more when the user cancels the dialog', async () => {
      mocks.invoke.mockResolvedValue(false);
      await expect(saveFile(blob(), 'chat.txt')).resolves.toBeUndefined();
      expect(mocks.saveAs).not.toHaveBeenCalled();
    });

    it.each([
      'Command save_chat_file not found',
      'save_chat_file not allowed. Command not found',
    ])('falls back to a download on an older app (%s)', async (message) => {
      mocks.invoke.mockRejectedValue(message);
      const file = blob();
      await saveFile(file, 'chat.txt');
      expect(mocks.saveAs).toHaveBeenCalledWith(file, 'chat.txt');
    });

    it('reports a failed save', async () => {
      mocks.invoke.mockRejectedValue('Could not save /x/chat.txt: denied');
      await expect(saveFile(blob(), 'chat.txt')).rejects.toBe(
        'Could not save /x/chat.txt: denied',
      );
      expect(mocks.saveAs).not.toHaveBeenCalled();
    });
  });
});
