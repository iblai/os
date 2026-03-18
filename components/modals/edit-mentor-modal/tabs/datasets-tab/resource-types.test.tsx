import { describe, it, expect } from 'vitest';
import { resourceTypes } from './resource-types';

describe('resourceTypes', () => {
  // --------------------------------------------------------------------------
  // Structure Tests
  // --------------------------------------------------------------------------

  describe('Structure', () => {
    it('exports a non-empty array of resource types', () => {
      expect(Array.isArray(resourceTypes)).toBe(true);
      expect(resourceTypes.length).toBeGreaterThan(0);
    });

    it('each resource type has required fields', () => {
      resourceTypes.forEach((resource) => {
        expect(resource.id).toBeDefined();
        expect(typeof resource.id).toBe('string');
        expect(resource.name).toBeDefined();
        expect(typeof resource.name).toBe('string');
        expect(resource.bgColor).toBeDefined();
        expect(typeof resource.isActive).toBe('boolean');
        expect(resource.icon).toBeDefined();
        expect(['url', 'github', 'local', 'link', 'webcrawler']).toContain(resource.type);
      });
    });

    it('each resource type has a unique id', () => {
      const ids = resourceTypes.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // --------------------------------------------------------------------------
  // Local File Resources
  // --------------------------------------------------------------------------

  describe('Local File Resources', () => {
    const localResources = resourceTypes.filter((r) => r.type === 'local');

    it('includes PDF resource with correct accept type', () => {
      const pdf = localResources.find((r) => r.id === 'pdf');
      expect(pdf).toBeDefined();
      expect(pdf!.accept).toBe('application/pdf');
      expect(pdf!.isActive).toBe(true);
    });

    it('includes DOCX resource with correct accept type', () => {
      const docx = localResources.find((r) => r.id === 'docx');
      expect(docx).toBeDefined();
      expect(docx!.accept).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(docx!.isActive).toBe(true);
    });

    it('includes Excel resource with correct accept type', () => {
      const excel = localResources.find((r) => r.id === 'excel');
      expect(excel).toBeDefined();
      expect(excel!.accept).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(excel!.isActive).toBe(true);
      expect(excel!.fileType).toBeUndefined();
    });

    it('includes CSV resource with correct accept type', () => {
      const csv = localResources.find((r) => r.id === 'csv');
      expect(csv).toBeDefined();
      expect(csv!.accept).toBe('text/csv,.csv');
      expect(csv!.isActive).toBe(true);
      expect(csv!.fileType).toBeUndefined();
    });

    it('includes PowerPoint resource with correct accept type', () => {
      const pptx = localResources.find((r) => r.id === 'powerpoint');
      expect(pptx).toBeDefined();
      expect(pptx!.accept).toBe(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      );
      expect(pptx!.isActive).toBe(true);
    });

    it('includes TXT resource with correct accept type', () => {
      const txt = localResources.find((r) => r.id === 'text');
      expect(txt).toBeDefined();
      expect(txt!.accept).toBe('text/plain');
      expect(txt!.isActive).toBe(true);
    });

    it('includes Audio resource with correct fileType', () => {
      const audio = localResources.find((r) => r.id === 'audio');
      expect(audio).toBeDefined();
      expect(audio!.accept).toBe('audio/*');
      expect(audio!.fileType).toBe('audio');
      expect(audio!.isActive).toBe(true);
    });

    it('includes Video resource with correct fileType', () => {
      const video = localResources.find((r) => r.id === 'video');
      expect(video).toBeDefined();
      expect(video!.accept).toBe('video/*');
      expect(video!.fileType).toBe('video');
      expect(video!.isActive).toBe(true);
    });

    it('includes Image resource with correct fileType', () => {
      const image = localResources.find((r) => r.id === 'image');
      expect(image).toBeDefined();
      expect(image!.accept).toBe('image/*');
      expect(image!.fileType).toBe('image');
      expect(image!.isActive).toBe(true);
    });

    it('includes ZIP resource as inactive', () => {
      const zip = localResources.find((r) => r.id === 'zip');
      expect(zip).toBeDefined();
      expect(zip!.accept).toBe('application/zip');
      expect(zip!.fileType).toBe('zip');
      expect(zip!.isActive).toBe(false);
    });

    it('includes Course resource as inactive', () => {
      const course = localResources.find((r) => r.id === 'courses');
      expect(course).toBeDefined();
      expect(course!.isActive).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // URL Resources
  // --------------------------------------------------------------------------

  describe('URL Resources', () => {
    const urlResources = resourceTypes.filter((r) => r.type === 'url');

    it('includes YouTube resource with correct fileType', () => {
      const youtube = urlResources.find((r) => r.id === 'youtube');
      expect(youtube).toBeDefined();
      expect(youtube!.fileType).toBe('youtube');
      expect(youtube!.isActive).toBe(true);
    });

    it('includes URL resource without fileType', () => {
      const url = urlResources.find((r) => r.id === 'url');
      expect(url).toBeDefined();
      expect(url!.fileType).toBeUndefined();
      expect(url!.isActive).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Link Resources (Cloud Storage)
  // --------------------------------------------------------------------------

  describe('Cloud Storage Resources', () => {
    const linkResources = resourceTypes.filter((r) => r.type === 'link');

    it('includes OneDrive, Google Drive, and Dropbox', () => {
      const ids = linkResources.map((r) => r.id);
      expect(ids).toContain('onedrive');
      expect(ids).toContain('google-drive');
      expect(ids).toContain('dropbox');
    });

    it('all cloud storage resources are active', () => {
      linkResources.forEach((r) => {
        expect(r.isActive).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Other Resources
  // --------------------------------------------------------------------------

  describe('Other Resources', () => {
    it('includes GitHub resource', () => {
      const github = resourceTypes.find((r) => r.id === 'github');
      expect(github).toBeDefined();
      expect(github!.type).toBe('github');
      expect(github!.isActive).toBe(true);
    });

    it('includes Web Crawler resource', () => {
      const crawler = resourceTypes.find((r) => r.id === 'web-crawler');
      expect(crawler).toBeDefined();
      expect(crawler!.type).toBe('webcrawler');
      expect(crawler!.isActive).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // CSV-specific tests (Issue #984)
  // --------------------------------------------------------------------------

  describe('CSV Resource (Issue #984)', () => {
    const csv = resourceTypes.find((r) => r.id === 'csv');

    it('exists in the resource types list', () => {
      expect(csv).toBeDefined();
    });

    it('has type "local" matching Excel behavior', () => {
      expect(csv!.type).toBe('local');
    });

    it('has no fileType so payload sends type "file" like Excel', () => {
      const excel = resourceTypes.find((r) => r.id === 'excel');
      expect(csv!.fileType).toBeUndefined();
      expect(excel!.fileType).toBeUndefined();
    });

    it('accepts CSV MIME type and extension', () => {
      expect(csv!.accept).toBe('text/csv,.csv');
    });

    it('is active', () => {
      expect(csv!.isActive).toBe(true);
    });

    it('has an icon defined', () => {
      expect(csv!.icon).toBeDefined();
    });
  });
});
