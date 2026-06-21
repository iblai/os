import { describe, it, expect } from 'vitest';
import { extractFilesFromClipboard } from '../clipboard';

const makeFile = (name: string) =>
  new File(['content'], name, { type: 'text/plain' });

const makeData = (data: Partial<DataTransfer>) => data as DataTransfer;

describe('extractFilesFromClipboard', () => {
  it('returns files from data.files when present', () => {
    const file = makeFile('a.txt');
    const result = extractFilesFromClipboard(
      makeData({ files: [file] as unknown as FileList }),
    );

    expect(result).toEqual([file]);
  });

  it('falls back to items when files is empty and returns file entries', () => {
    const file = makeFile('b.txt');
    const result = extractFilesFromClipboard(
      makeData({
        files: [] as unknown as FileList,
        items: [
          { kind: 'file', getAsFile: () => file },
        ] as unknown as DataTransferItemList,
      }),
    );

    expect(result).toEqual([file]);
  });

  it('excludes non-file items', () => {
    const file = makeFile('c.txt');
    const result = extractFilesFromClipboard(
      makeData({
        items: [
          { kind: 'string', getAsFile: () => null },
          { kind: 'file', getAsFile: () => file },
        ] as unknown as DataTransferItemList,
      }),
    );

    expect(result).toEqual([file]);
  });

  it('excludes file items whose getAsFile returns null', () => {
    const result = extractFilesFromClipboard(
      makeData({
        items: [
          { kind: 'file', getAsFile: () => null },
        ] as unknown as DataTransferItemList,
      }),
    );

    expect(result).toEqual([]);
  });

  it('returns an empty array when files and items are absent', () => {
    const result = extractFilesFromClipboard(makeData({}));

    expect(result).toEqual([]);
  });
});
