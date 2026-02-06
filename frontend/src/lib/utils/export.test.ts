import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToJSON, exportToCSV } from './export';
import type { TwitterEvent } from '$lib/types';

describe('Export Utilities', () => {
  let createElementSpy: any;
  let appendChildSpy: any;
  let removeChildSpy: any;
  let clickSpy: any;
  let createObjectURLSpy: any;
  let revokeObjectURLSpy: any;

  beforeEach(() => {
    clickSpy = vi.fn();
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      click: clickSpy,
      href: '',
      download: ''
    } as any);
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockEvent = (id: string, type: string = 'post_created'): TwitterEvent => ({
    type: type as any,
    timestamp: new Date().toISOString(),
    primaryId: id,
    user: {
      username: `user${id}`,
      displayName: `User ${id}`,
      userId: `uid${id}`
    },
    data: {
      tweetId: id,
      username: `user${id}`,
      action: 'created',
      tweet: {
        id,
        type: 'tweet',
        created_at: new Date().toISOString(),
        body: {
          text: `This is tweet ${id}`,
          mentions: []
        },
        author: {
          handle: `user${id}`,
          profile: {
            name: `User ${id}`
          }
        }
      }
    } as any
  });

  describe('exportToJSON', () => {
    it('should export events as JSON', () => {
      const events = [createMockEvent('1'), createMockEvent('2')];
      
      exportToJSON(events, 'test.json');
      
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it('should use default filename if not provided', () => {
      const events = [createMockEvent('1')];
      const linkElement = { click: clickSpy, href: '', download: '' };
      createElementSpy.mockReturnValue(linkElement);
      
      exportToJSON(events);
      
      expect(linkElement.download).toBe('events.json');
    });

    it('should handle empty events array', () => {
      exportToJSON([], 'empty.json');
      
      expect(createElementSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle large datasets', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => createMockEvent(String(i)));
      
      exportToJSON(largeDataset, 'large.json');
      
      expect(createElementSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('exportToCSV', () => {
    it('should export events as CSV', () => {
      const events = [createMockEvent('1'), createMockEvent('2')];
      
      exportToCSV(events, 'test.csv');
      
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('should use default filename if not provided', () => {
      const events = [createMockEvent('1')];
      const linkElement = { click: clickSpy, href: '', download: '' };
      createElementSpy.mockReturnValue(linkElement);
      
      exportToCSV(events);
      
      expect(linkElement.download).toBe('events.csv');
    });

    it('should handle empty events array', () => {
      exportToCSV([], 'empty.csv');
      
      expect(createElementSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should escape CSV special characters', () => {
      const event = createMockEvent('1');
      event.data = {
        ...event.data,
        tweet: {
          ...((event.data as any).tweet),
          body: {
            text: 'Text with "quotes" and, commas',
            mentions: []
          }
        }
      } as any;
      
      exportToCSV([event], 'escaped.csv');
      
      expect(createElementSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle large datasets', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => createMockEvent(String(i)));
      
      exportToCSV(largeDataset, 'large.csv');
      
      expect(createElementSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle different event types', () => {
      const events = [
        createMockEvent('1', 'post_created'),
        createMockEvent('2', 'profile_updated'),
        createMockEvent('3', 'follow_created')
      ];
      
      exportToCSV(events, 'mixed.csv');
      
      expect(createElementSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle very large datasets (10000 events)', () => {
      const veryLargeDataset = Array.from({ length: 10000 }, (_, i) => createMockEvent(String(i)));
      
      exportToCSV(veryLargeDataset, 'very-large.csv');
      
      expect(createElementSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
