import { describe, it, expect } from 'vitest';
import { isFileAccepted } from '../utils';

const createFile = (name: string, type: string) => new File([''], name, { type });

describe('isFileAccepted', () => {
  it('should accept any file when acceptedTypes is empty', () => {
    const file = createFile('anything.exe', 'application/x-msdownload');
    expect(isFileAccepted(file, [])).toBe(true);
  });

  describe('extension matching', () => {
    it('should match a file by extension', () => {
      const file = createFile('report.pdf', 'application/pdf');
      expect(isFileAccepted(file, ['.pdf'])).toBe(true);
    });

    it('should reject a file with a non-matching extension', () => {
      const file = createFile('app.exe', 'application/x-msdownload');
      expect(isFileAccepted(file, ['.pdf', '.docx'])).toBe(false);
    });

    it('should match extensions case-insensitively', () => {
      const file = createFile('IMAGE.PNG', 'image/png');
      expect(isFileAccepted(file, ['.png'])).toBe(true);
    });

    it('should match when accepted extension is uppercase', () => {
      const file = createFile('image.png', 'image/png');
      expect(isFileAccepted(file, ['.PNG'])).toBe(true);
    });
  });

  describe('exact MIME type matching', () => {
    it('should match an exact MIME type', () => {
      const file = createFile('photo.jpg', 'image/jpeg');
      expect(isFileAccepted(file, ['image/jpeg'])).toBe(true);
    });

    it('should reject a non-matching MIME type', () => {
      const file = createFile('photo.jpg', 'image/jpeg');
      expect(isFileAccepted(file, ['application/pdf'])).toBe(false);
    });
  });

  describe('wildcard MIME type matching', () => {
    it('should match image/* wildcard', () => {
      const file = createFile('photo.webp', 'image/webp');
      expect(isFileAccepted(file, ['image/*'])).toBe(true);
    });

    it('should match video/* wildcard', () => {
      const file = createFile('clip.mp4', 'video/mp4');
      expect(isFileAccepted(file, ['video/*'])).toBe(true);
    });

    it('should match audio/* wildcard', () => {
      const file = createFile('song.mp3', 'audio/mpeg');
      expect(isFileAccepted(file, ['audio/*'])).toBe(true);
    });

    it('should not match a different category with wildcard', () => {
      const file = createFile('doc.pdf', 'application/pdf');
      expect(isFileAccepted(file, ['image/*'])).toBe(false);
    });
  });

  describe('mixed accepted types', () => {
    const acceptedTypes = ['image/*', '.pdf', '.docx', 'text/plain'];

    it('should accept a file matching the wildcard', () => {
      expect(isFileAccepted(createFile('pic.png', 'image/png'), acceptedTypes)).toBe(true);
    });

    it('should accept a file matching an extension', () => {
      expect(isFileAccepted(createFile('doc.pdf', 'application/pdf'), acceptedTypes)).toBe(true);
    });

    it('should accept a file matching an exact MIME type', () => {
      expect(isFileAccepted(createFile('notes.txt', 'text/plain'), acceptedTypes)).toBe(true);
    });

    it('should reject a file matching none of the types', () => {
      expect(isFileAccepted(createFile('app.exe', 'application/x-msdownload'), acceptedTypes)).toBe(
        false,
      );
    });
  });
});
