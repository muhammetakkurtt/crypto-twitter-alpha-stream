import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSwipeGesture } from './useSwipeGesture';

describe('useSwipeGesture', () => {
  let element: HTMLElement;
  
  beforeEach(() => {
    element = document.createElement('div');
    vi.useFakeTimers();
  });
  
  describe('Edge Detection', () => {
    it('should detect swipe from left edge (within 20px)', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge (10px from left)
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      expect(gesture.state.isSwiping).toBe(true);
      expect(gesture.state.direction).toBe('right');
      
      cleanup();
    });
    
    it('should detect swipe from right edge (within 20px)', () => {
      const onSwipeLeft = vi.fn();
      const gesture = useSwipeGesture({ onSwipeLeft, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Mock window width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });
      
      // Touch start at right edge (1014px from left, 10px from right)
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 1014, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      expect(gesture.state.isSwiping).toBe(true);
      expect(gesture.state.direction).toBe('left');
      
      cleanup();
    });
    
    it('should not detect swipe from middle of screen', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start in middle (500px from left)
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 500, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      expect(gesture.state.isSwiping).toBe(false);
      expect(gesture.state.direction).toBe(null);
      
      cleanup();
    });
  });
  
  describe('Swipe Direction', () => {
    it('should trigger onSwipeRight for swipe-right from left edge', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move right (60px)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 70, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      // Touch end
      const touchEnd = new TouchEvent('touchend', {
        touches: []
      });
      element.dispatchEvent(touchEnd);
      
      expect(onSwipeRight).toHaveBeenCalled();
      
      cleanup();
    });
    
    it('should trigger onSwipeLeft for swipe-left from right edge', () => {
      const onSwipeLeft = vi.fn();
      const gesture = useSwipeGesture({ onSwipeLeft, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Mock window width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });
      
      // Touch start at right edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 1014, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move left (60px)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 954, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      // Touch end
      const touchEnd = new TouchEvent('touchend', {
        touches: []
      });
      element.dispatchEvent(touchEnd);
      
      expect(onSwipeLeft).toHaveBeenCalled();
      
      cleanup();
    });
    
    it('should not trigger swipe for wrong direction', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move left (wrong direction)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 5, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      // Touch end
      const touchEnd = new TouchEvent('touchend', {
        touches: []
      });
      element.dispatchEvent(touchEnd);
      
      expect(onSwipeRight).not.toHaveBeenCalled();
      
      cleanup();
    });
  });
  
  describe('Swipe Progress', () => {
    it('should call onSwipeProgress with progress value (0-1)', () => {
      const onSwipeProgress = vi.fn();
      const gesture = useSwipeGesture({ onSwipeProgress, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move right (160px = 50% of 320px sidebar width)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 170, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      expect(onSwipeProgress).toHaveBeenCalled();
      expect(gesture.state.progress).toBeCloseTo(0.5, 1);
      
      cleanup();
    });
    
    it('should cap progress at 1.0', () => {
      const onSwipeProgress = vi.fn();
      const gesture = useSwipeGesture({ onSwipeProgress, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move right (400px > 320px sidebar width)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 410, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      expect(gesture.state.progress).toBe(1);
      
      cleanup();
    });
    
    it('should reset progress to 0 on touch end', () => {
      const onSwipeProgress = vi.fn();
      const gesture = useSwipeGesture({ onSwipeProgress, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move right
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 170, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      // Touch end
      const touchEnd = new TouchEvent('touchend', {
        touches: []
      });
      element.dispatchEvent(touchEnd);
      
      // Should call with 0 to reset
      expect(onSwipeProgress).toHaveBeenLastCalledWith(0);
      
      cleanup();
    });
  });
  
  describe('Vertical vs Horizontal Movement', () => {
    it('should cancel swipe if movement is more vertical than horizontal', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move more vertically (10px horizontal, 50px vertical)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 20, clientY: 150 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      expect(gesture.state.isSwiping).toBe(false);
      
      cleanup();
    });
  });
  
  describe('Threshold Detection', () => {
    it('should trigger swipe when distance threshold is met (50px)', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move right (exactly 50px)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 60, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      // Touch end
      const touchEnd = new TouchEvent('touchend', {
        touches: []
      });
      element.dispatchEvent(touchEnd);
      
      expect(onSwipeRight).toHaveBeenCalled();
      
      cleanup();
    });
    
    it('should not trigger swipe when distance threshold is not met', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Advance time to ensure low velocity
      vi.advanceTimersByTime(1000);
      
      // Touch move right (only 20px - less than 30% of 320px sidebar width)
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 30, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      // Touch end
      const touchEnd = new TouchEvent('touchend', {
        touches: []
      });
      element.dispatchEvent(touchEnd);
      
      expect(onSwipeRight).not.toHaveBeenCalled();
      
      cleanup();
    });
  });
  
  describe('Enabled/Disabled State', () => {
    it('should not detect swipes when disabled', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight, enabled: false });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      expect(gesture.state.isSwiping).toBe(false);
      
      cleanup();
    });
    
    it('should be enabled by default', () => {
      const onSwipeRight = vi.fn();
      const gesture = useSwipeGesture({ onSwipeRight });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      expect(gesture.state.isSwiping).toBe(true);
      
      cleanup();
    });
  });
  
  describe('Touch Cancel', () => {
    it('should reset state on touch cancel', () => {
      const onSwipeProgress = vi.fn();
      const gesture = useSwipeGesture({ onSwipeProgress, enabled: true });
      const cleanup = gesture.attach(element);
      
      // Touch start at left edge
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchStart);
      
      // Touch move
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });
      element.dispatchEvent(touchMove);
      
      // Touch cancel
      const touchCancel = new TouchEvent('touchcancel', {
        touches: []
      });
      element.dispatchEvent(touchCancel);
      
      expect(gesture.state.isSwiping).toBe(false);
      expect(onSwipeProgress).toHaveBeenLastCalledWith(0);
      
      cleanup();
    });
  });
  
  describe('Cleanup', () => {
    it('should remove event listeners on cleanup', () => {
      const gesture = useSwipeGesture({ enabled: true });
      const cleanup = gesture.attach(element);
      
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      
      cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function));
    });
  });
});
