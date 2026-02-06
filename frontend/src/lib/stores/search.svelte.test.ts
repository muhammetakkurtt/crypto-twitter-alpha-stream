import { describe, it, expect, beforeEach } from 'vitest';
import { searchStore } from './search.svelte';

describe('SearchStore', () => {
  beforeEach(() => {
    searchStore.clear();
    searchStore.clearHistory();
    localStorage.clear();
  });

  describe('setQuery', () => {
    it('should set the search query', () => {
      searchStore.setQuery('bitcoin');
      expect(searchStore.query).toBe('bitcoin');
    });

    it('should update query when called multiple times', () => {
      searchStore.setQuery('bitcoin');
      searchStore.setQuery('ethereum');
      expect(searchStore.query).toBe('ethereum');
    });
  });

  describe('addToHistory', () => {
    it('should add query to history', () => {
      searchStore.addToHistory('bitcoin');
      expect(searchStore.history).toContain('bitcoin');
    });

    it('should not add empty queries to history', () => {
      searchStore.addToHistory('');
      searchStore.addToHistory('   ');
      expect(searchStore.history).toHaveLength(0);
    });

    it('should trim queries before adding to history', () => {
      searchStore.addToHistory('  bitcoin  ');
      expect(searchStore.history).toContain('bitcoin');
      expect(searchStore.history).not.toContain('  bitcoin  ');
    });

    it('should move existing query to top of history', () => {
      searchStore.addToHistory('bitcoin');
      searchStore.addToHistory('ethereum');
      searchStore.addToHistory('bitcoin');
      
      expect(searchStore.history[0]).toBe('bitcoin');
      expect(searchStore.history).toHaveLength(2);
    });

    it('should limit history to 10 items', () => {
      for (let i = 0; i < 15; i++) {
        searchStore.addToHistory(`query${i}`);
      }
      
      expect(searchStore.history).toHaveLength(10);
      expect(searchStore.history[0]).toBe('query14');
    });
  });

  describe('removeFromHistory', () => {
    it('should remove query from history', () => {
      searchStore.addToHistory('bitcoin');
      searchStore.addToHistory('ethereum');
      
      searchStore.removeFromHistory('bitcoin');
      
      expect(searchStore.history).not.toContain('bitcoin');
      expect(searchStore.history).toContain('ethereum');
    });

    it('should do nothing if query not in history', () => {
      searchStore.addToHistory('bitcoin');
      searchStore.removeFromHistory('ethereum');
      
      expect(searchStore.history).toContain('bitcoin');
      expect(searchStore.history).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      searchStore.addToHistory('bitcoin');
      searchStore.addToHistory('ethereum');
      
      searchStore.clearHistory();
      
      expect(searchStore.history).toHaveLength(0);
    });
  });

  describe('setActive', () => {
    it('should set active state', () => {
      searchStore.setActive(true);
      expect(searchStore.isActive).toBe(true);
      
      searchStore.setActive(false);
      expect(searchStore.isActive).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear the query', () => {
      searchStore.setQuery('bitcoin');
      searchStore.clear();
      
      expect(searchStore.query).toBe('');
    });

    it('should not clear history', () => {
      searchStore.addToHistory('bitcoin');
      searchStore.setQuery('ethereum');
      searchStore.clear();
      
      expect(searchStore.query).toBe('');
      expect(searchStore.history).toContain('bitcoin');
    });
  });

  describe('localStorage persistence', () => {
    it('should save history to localStorage', () => {
      searchStore.addToHistory('bitcoin');
      
      const stored = localStorage.getItem('crypto-twitter-search-history');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed).toContain('bitcoin');
    });

    it('should load history from localStorage', () => {
      localStorage.setItem('crypto-twitter-search-history', JSON.stringify(['bitcoin', 'ethereum']));
      
      const newStore = new (searchStore.constructor as any)();
      expect(newStore.history).toEqual(['bitcoin', 'ethereum']);
    });
  });
});
