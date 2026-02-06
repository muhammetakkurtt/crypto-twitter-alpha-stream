/**
 * Lazy loading hook using Intersection Observer API
 * Triggers a callback when an element enters the viewport
 */

export interface LazyLoadOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export interface LazyLoadResult {
  observe: (element: Element) => void;
  unobserve: (element: Element) => void;
  disconnect: () => void;
}

export function useLazyLoad(
  onIntersect: (entry: IntersectionObserverEntry) => void,
  options: LazyLoadOptions = {}
): LazyLoadResult {
  const { root = null, rootMargin = '50px', threshold = 0.01 } = options;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onIntersect(entry);
          // Unobserve after loading to prevent re-triggering
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root,
      rootMargin,
      threshold
    }
  );

  return {
    observe: (element: Element) => observer.observe(element),
    unobserve: (element: Element) => observer.unobserve(element),
    disconnect: () => observer.disconnect()
  };
}
