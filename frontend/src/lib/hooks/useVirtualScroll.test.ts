import { describe, it, expect } from 'vitest';
import { useVirtualScroll } from './useVirtualScroll';

describe('useVirtualScroll', () => {
  it('should calculate visible range for items at top', () => {
    const result = useVirtualScroll(100, 0, {
      itemHeight: 200,
      bufferSize: 5,
      containerHeight: 1000
    });

    expect(result.visibleRange.start).toBe(0);
    expect(result.visibleRange.end).toBeLessThanOrEqual(100);
    expect(result.totalHeight).toBe(20000);
    expect(result.offsetY).toBe(0);
  });

  it('should calculate visible range for scrolled position', () => {
    const result = useVirtualScroll(100, 2000, {
      itemHeight: 200,
      bufferSize: 5,
      containerHeight: 1000
    });

    expect(result.visibleRange.start).toBe(5);
    expect(result.visibleRange.end).toBe(20);
    expect(result.offsetY).toBe(1000);
  });

  it('should include buffer items', () => {
    const result = useVirtualScroll(100, 1000, {
      itemHeight: 100,
      bufferSize: 3,
      containerHeight: 500
    });

    expect(result.visibleRange.start).toBe(7);
    expect(result.visibleRange.end).toBe(18);
  });

  it('should not go below zero for start index', () => {
    const result = useVirtualScroll(100, 100, {
      itemHeight: 200,
      bufferSize: 10,
      containerHeight: 1000
    });

    expect(result.visibleRange.start).toBe(0);
    expect(result.visibleRange.start).toBeGreaterThanOrEqual(0);
  });

  it('should not exceed item count for end index', () => {
    const result = useVirtualScroll(50, 10000, {
      itemHeight: 200,
      bufferSize: 5,
      containerHeight: 1000
    });

    expect(result.visibleRange.end).toBe(50);
    expect(result.visibleRange.end).toBeLessThanOrEqual(50);
  });

  it('should handle zero items', () => {
    const result = useVirtualScroll(0, 0, {
      itemHeight: 200,
      containerHeight: 1000
    });

    expect(result.visibleRange.start).toBe(0);
    expect(result.visibleRange.end).toBe(0);
    expect(result.totalHeight).toBe(0);
  });

  it('should use default buffer size when not provided', () => {
    const result = useVirtualScroll(100, 1000, {
      itemHeight: 100,
      containerHeight: 500
    });

    expect(result.visibleRange.start).toBe(5);
    expect(result.visibleRange.end).toBe(20);
  });
});
