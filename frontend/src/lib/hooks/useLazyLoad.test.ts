import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLazyLoad } from './useLazyLoad';

describe('useLazyLoad', () => {
  let mockObserver: any;
  let observeCallback: IntersectionObserverCallback;
  let IntersectionObserverSpy: any;

  beforeEach(() => {
    mockObserver = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    };

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observeCallback = callback;
        Object.assign(this, mockObserver);
      }
    }

    IntersectionObserverSpy = vi.fn(MockIntersectionObserver);
    global.IntersectionObserver = IntersectionObserverSpy as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create IntersectionObserver with default options', () => {
    const onIntersect = vi.fn();
    useLazyLoad(onIntersect);

    expect(IntersectionObserverSpy).toHaveBeenCalledWith(
      expect.any(Function),
      {
        root: null,
        rootMargin: '50px',
        threshold: 0.01
      }
    );
  });

  it('should create IntersectionObserver with custom options', () => {
    const onIntersect = vi.fn();
    const customRoot = document.createElement('div');
    
    useLazyLoad(onIntersect, {
      root: customRoot,
      rootMargin: '100px',
      threshold: 0.5
    });

    expect(IntersectionObserverSpy).toHaveBeenCalledWith(
      expect.any(Function),
      {
        root: customRoot,
        rootMargin: '100px',
        threshold: 0.5
      }
    );
  });

  it('should observe element', () => {
    const onIntersect = vi.fn();
    const result = useLazyLoad(onIntersect);
    const element = document.createElement('div');

    result.observe(element);

    expect(mockObserver.observe).toHaveBeenCalledWith(element);
  });

  it('should unobserve element', () => {
    const onIntersect = vi.fn();
    const result = useLazyLoad(onIntersect);
    const element = document.createElement('div');

    result.unobserve(element);

    expect(mockObserver.unobserve).toHaveBeenCalledWith(element);
  });

  it('should disconnect observer', () => {
    const onIntersect = vi.fn();
    const result = useLazyLoad(onIntersect);

    result.disconnect();

    expect(mockObserver.disconnect).toHaveBeenCalled();
  });

  it('should call onIntersect when element is intersecting', () => {
    const onIntersect = vi.fn();
    useLazyLoad(onIntersect);

    const mockEntry = {
      isIntersecting: true,
      target: document.createElement('div'),
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 1,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: 0
    } as IntersectionObserverEntry;

    observeCallback([mockEntry], mockObserver);

    expect(onIntersect).toHaveBeenCalledWith(mockEntry);
  });

  it('should not call onIntersect when element is not intersecting', () => {
    const onIntersect = vi.fn();
    useLazyLoad(onIntersect);

    const mockEntry = {
      isIntersecting: false,
      target: document.createElement('div'),
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: 0
    } as IntersectionObserverEntry;

    observeCallback([mockEntry], mockObserver);

    expect(onIntersect).not.toHaveBeenCalled();
  });

  it('should handle multiple entries', () => {
    const onIntersect = vi.fn();
    useLazyLoad(onIntersect);

    const createMockEntry = (isIntersecting: boolean): IntersectionObserverEntry => ({
      isIntersecting,
      target: document.createElement('div'),
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: 0
    } as IntersectionObserverEntry);

    const entries = [
      createMockEntry(true),
      createMockEntry(false),
      createMockEntry(true)
    ];

    observeCallback(entries, mockObserver);

    expect(onIntersect).toHaveBeenCalledTimes(2);
  });
});
