import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sidebarStore } from './sidebar.svelte';

describe('SidebarStore', () => {
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn()
    } as Storage;

    // Reset store state
    sidebarStore.rightCollapsed = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have rightCollapsed property', () => {
      expect('rightCollapsed' in sidebarStore).toBe(true);
    });

    it('should not have leftCollapsed property', () => {
      expect('leftCollapsed' in sidebarStore).toBe(false);
    });

    it('should not have focusMode property', () => {
      expect('focusMode' in sidebarStore).toBe(false);
    });

    it('should not have bothCollapsed computed property', () => {
      expect('bothCollapsed' in sidebarStore).toBe(false);
    });

    it('should have anyCollapsed computed property', () => {
      expect('anyCollapsed' in sidebarStore).toBe(true);
    });

    it('should have isMobile computed property', () => {
      expect('isMobile' in sidebarStore).toBe(true);
    });
  });

  describe('toggleRight()', () => {
    it('should have toggleRight method', () => {
      expect(typeof sidebarStore.toggleRight).toBe('function');
    });

    it('should toggle rightCollapsed state', () => {
      const initial = sidebarStore.rightCollapsed;
      sidebarStore.toggleRight();
      expect(sidebarStore.rightCollapsed).toBe(!initial);
      sidebarStore.toggleRight();
      expect(sidebarStore.rightCollapsed).toBe(initial);
    });
  });

  describe('Removed Methods', () => {
    it('should not have toggleLeft method', () => {
      expect('toggleLeft' in sidebarStore).toBe(false);
    });

    it('should not have toggleFocusMode method', () => {
      expect('toggleFocusMode' in sidebarStore).toBe(false);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should toggle right sidebar on Ctrl+F', () => {
      const initial = sidebarStore.rightCollapsed;
      
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        shiftKey: false,
        bubbles: true,
        cancelable: true
      });
      
      window.dispatchEvent(event);
      expect(sidebarStore.rightCollapsed).toBe(!initial);
    });

    it('should not respond to Ctrl+B (removed)', () => {
      const initial = sidebarStore.rightCollapsed;
      
      const event = new KeyboardEvent('keydown', {
        key: 'b',
        ctrlKey: true,
        shiftKey: false,
        bubbles: true,
        cancelable: true
      });
      
      window.dispatchEvent(event);
      expect(sidebarStore.rightCollapsed).toBe(initial);
    });

    it('should not respond to Ctrl+Shift+F (focus mode removed)', () => {
      const initial = sidebarStore.rightCollapsed;
      
      const event = new KeyboardEvent('keydown', {
        key: 'F',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      
      window.dispatchEvent(event);
      expect(sidebarStore.rightCollapsed).toBe(initial);
    });
  });

  describe('State Persistence', () => {
    it('should save only rightCollapsed to localStorage', async () => {
      sidebarStore.toggleRight();
      
      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(localStorage.setItem).toHaveBeenCalled();
      const calls = (localStorage.setItem as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      
      if (lastCall) {
        const savedData = JSON.parse(lastCall[1]);
        expect(savedData).toHaveProperty('rightCollapsed');
        expect('leftCollapsed' in savedData).toBe(false);
        expect('focusMode' in savedData).toBe(false);
      }
    });

    it('should only load rightCollapsed from localStorage', () => {
      // This test verifies the structure by checking what properties exist
      expect('rightCollapsed' in sidebarStore).toBe(true);
      expect('leftCollapsed' in sidebarStore).toBe(false);
      expect('focusMode' in sidebarStore).toBe(false);
    });
  });

  describe('Computed Properties', () => {
    it('anyCollapsed should be accessible', () => {
      expect(typeof sidebarStore.anyCollapsed).toBe('boolean');
    });

    it('should not have bothCollapsed property', () => {
      expect('bothCollapsed' in sidebarStore).toBe(false);
    });
  });
});
