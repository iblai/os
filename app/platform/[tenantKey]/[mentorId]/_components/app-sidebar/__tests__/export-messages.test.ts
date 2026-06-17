import { describe, it, expect, vi, beforeEach } from 'vitest';
import writeXlsxFile from 'write-excel-file/browser';
import { saveAs } from 'file-saver';
import { exportMessagesToXlsx } from '../export-messages';

vi.mock('write-excel-file/browser', () => ({
  default: vi.fn(() => ({
    toBlob: vi.fn(() => Promise.resolve(new Blob())),
  })),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

const mockWriteXlsxFile = vi.mocked(writeXlsxFile);
const mockSaveAs = vi.mocked(saveAs);

describe('exportMessagesToXlsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out messages without content and writes a Messages sheet', async () => {
    const messages = [
      { message: { data: { type: 'human', content: 'Hello' } } },
      { message: { data: { type: 'ai', content: '' } } }, // filtered out
      { message: { data: { type: 'ai', content: 'World' } } },
    ];

    await exportMessagesToXlsx(messages);

    expect(mockWriteXlsxFile).toHaveBeenCalledTimes(1);
    const [data, options] = mockWriteXlsxFile.mock.calls[0] as [any, any];

    // The empty-content message is dropped.
    expect(data).toHaveLength(2);
    expect(options.sheet).toBe('Messages');
    expect(options.columns.map((column: any) => column.header)).toEqual([
      'Message Type',
      'Content',
    ]);

    // The column `cell` accessors read type/content off each message.
    expect(options.columns[0].cell(data[0])).toBe('human');
    expect(options.columns[1].cell(data[0])).toBe('Hello');
    expect(options.columns[0].cell(data[1])).toBe('ai');
    expect(options.columns[1].cell(data[1])).toBe('World');
  });

  it('downloads the generated blob as messages.xlsx', async () => {
    await exportMessagesToXlsx([
      { message: { data: { type: 'ai', content: 'x' } } },
    ]);

    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), 'messages.xlsx');
  });

  it('logs an error and does not download when generation fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockWriteXlsxFile.mockReturnValueOnce({
      toBlob: vi.fn(() => Promise.reject(new Error('boom'))),
    } as any);

    await exportMessagesToXlsx([
      { message: { data: { type: 'ai', content: 'x' } } },
    ]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to export messages: ',
      expect.any(Error),
    );
    expect(mockSaveAs).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
