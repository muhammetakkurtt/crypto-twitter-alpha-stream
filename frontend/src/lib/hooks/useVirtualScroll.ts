/**
 * Virtual scrolling hook for efficiently rendering large lists
 * Only renders visible items plus a buffer to maintain smooth scrolling
 */

export interface VirtualScrollOptions {
  itemHeight: number;
  bufferSize?: number;
  containerHeight?: number;
}

export interface VirtualScrollResult {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
}

export function useVirtualScroll(
  itemCount: number,
  scrollTop: number,
  options: VirtualScrollOptions
): VirtualScrollResult {
  const { itemHeight, bufferSize = 5, containerHeight = window.innerHeight } = options;

  const totalHeight = itemCount * itemHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
  const endIndex = Math.min(
    itemCount,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize
  );

  const offsetY = startIndex * itemHeight;

  return {
    visibleRange: { start: startIndex, end: endIndex },
    totalHeight,
    offsetY
  };
}
