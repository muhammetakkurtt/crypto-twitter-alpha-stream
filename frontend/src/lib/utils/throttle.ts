/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 * Useful for rate-limiting events like scroll, resize, etc.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastTime;
    
    if (timeSinceLastCall >= wait) {
      lastTime = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastTime = Date.now();
        fn(...args);
      }, wait - timeSinceLastCall);
    }
  };
}
