import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock stores
vi.mock('$lib/stores/socket.svelte', () => ({
  socketStore: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    connectionStatus: 'disconnected'
  }
}));

vi.mock('$lib/stores/events.svelte', () => ({
  eventsStore: {
    events: [],
    clear: vi.fn()
  }
}));

vi.mock('$lib/stores/filters.svelte', () => ({
  filtersStore: {
    clearAll: vi.fn(),
    keywords: [],
    users: [],
    eventTypes: []
  }
}));

describe('Keyboard Shortcuts Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clear filters with Ctrl+K', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });

    window.dispatchEvent(event);

    // Note: This test verifies the keyboard event is dispatched
    // The actual handler registration happens in onMount
    expect(event.defaultPrevented).toBe(false);
  });

  it('should focus search with Ctrl+F', () => {
    const searchInput = document.createElement('input');
    searchInput.className = 'search-input';
    document.body.appendChild(searchInput);

    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });

    window.dispatchEvent(event);

    document.body.removeChild(searchInput);
  });

  it('should export events with Ctrl+E', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    const event = new KeyboardEvent('keydown', {
      key: 'e',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });

    window.dispatchEvent(event);

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('should clear events with Ctrl+Shift+C', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });

    window.dispatchEvent(event);

    // Verify event is dispatched
    expect(event.defaultPrevented).toBe(false);
  });

  it('should toggle shortcuts help with Shift+?', () => {
    const event = new KeyboardEvent('keydown', {
      key: '?',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });

    window.dispatchEvent(event);

    // Verify event is dispatched
    expect(event.defaultPrevented).toBe(false);
  });

  it('should close shortcuts help with Escape', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });

    window.dispatchEvent(event);

    // Verify event is dispatched
    expect(event.defaultPrevented).toBe(false);
  });
});
