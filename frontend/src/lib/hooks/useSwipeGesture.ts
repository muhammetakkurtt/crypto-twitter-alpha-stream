/**
 * useSwipeGesture Hook
 * 
 * Detects swipe gestures from screen edges for mobile sidebar interactions.
 * - Swipe-right from left edge (within 20px) opens left sidebar
 * - Swipe-left from right edge (within 20px) opens right sidebar
 * - Supports smooth follow-finger animation during swipe
 */

const EDGE_THRESHOLD = 20; // px from edge to detect swipe start
const SWIPE_THRESHOLD = 50; // minimum distance to trigger swipe
const SWIPE_VELOCITY_THRESHOLD = 0.3; // minimum velocity (px/ms)

export interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeProgress?: (progress: number) => void; // 0-1 for follow-finger animation
  enabled?: boolean;
}

export interface SwipeGestureState {
  isSwiping: boolean;
  direction: 'left' | 'right' | null;
  progress: number; // 0-1
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
}

export function useSwipeGesture(options: SwipeGestureOptions = {}) {
  const state: SwipeGestureState = {
    isSwiping: false,
    direction: null,
    progress: 0,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0
  };
  
  const enabled = options.enabled ?? true;
  
  function handleTouchStart(e: TouchEvent) {
    if (!enabled) return;
    
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    const windowWidth = window.innerWidth;
    
    // Check if touch started near left or right edge
    const isLeftEdge = x <= EDGE_THRESHOLD;
    const isRightEdge = x >= windowWidth - EDGE_THRESHOLD;
    
    if (!isLeftEdge && !isRightEdge) {
      return;
    }
    
    state.isSwiping = true;
    state.startX = x;
    state.startY = y;
    state.currentX = x;
    state.currentY = y;
    state.startTime = Date.now();
    state.direction = isLeftEdge ? 'right' : 'left';
    state.progress = 0;
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (!enabled || !state.isSwiping) return;
    
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    state.currentX = x;
    state.currentY = y;
    
    const deltaX = x - state.startX;
    const deltaY = y - state.startY;
    
    // Check if movement is more horizontal than vertical
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    
    if (!isHorizontal) {
      // Cancel swipe if movement is more vertical
      resetState();
      return;
    }
    
    // Calculate progress (0-1) based on swipe distance
    // For left edge swipe-right: positive deltaX
    // For right edge swipe-left: negative deltaX
    let progress = 0;
    
    if (state.direction === 'right' && deltaX > 0) {
      // Swipe right from left edge
      progress = Math.min(deltaX / 320, 1); // 320px = sidebar width
      e.preventDefault(); // Prevent scrolling
    } else if (state.direction === 'left' && deltaX < 0) {
      // Swipe left from right edge
      progress = Math.min(Math.abs(deltaX) / 360, 1); // 360px = right sidebar width
      e.preventDefault(); // Prevent scrolling
    } else {
      // Wrong direction, cancel
      resetState();
      return;
    }
    
    state.progress = progress;
    
    // Call progress callback for follow-finger animation
    if (options.onSwipeProgress) {
      options.onSwipeProgress(progress);
    }
  }
  
  function handleTouchEnd(_e: TouchEvent) {
    if (!enabled || !state.isSwiping) return;
    
    const deltaX = state.currentX - state.startX;
    const deltaTime = Date.now() - state.startTime;
    const velocity = Math.abs(deltaX) / deltaTime; // px/ms
    
    // Determine if swipe should trigger action
    const distanceThresholdMet = Math.abs(deltaX) >= SWIPE_THRESHOLD;
    const velocityThresholdMet = velocity >= SWIPE_VELOCITY_THRESHOLD;
    const progressThresholdMet = state.progress >= 0.3; // 30% of sidebar width
    
    const shouldTrigger = distanceThresholdMet || velocityThresholdMet || progressThresholdMet;
    
    if (shouldTrigger) {
      if (state.direction === 'right' && deltaX > 0 && options.onSwipeRight) {
        options.onSwipeRight();
      } else if (state.direction === 'left' && deltaX < 0 && options.onSwipeLeft) {
        options.onSwipeLeft();
      }
    }
    
    // Reset progress callback
    if (options.onSwipeProgress) {
      options.onSwipeProgress(0);
    }
    
    resetState();
  }
  
  function handleTouchCancel() {
    if (!enabled) return;
    
    // Reset progress callback
    if (options.onSwipeProgress) {
      options.onSwipeProgress(0);
    }
    
    resetState();
  }
  
  function resetState() {
    state.isSwiping = false;
    state.direction = null;
    state.progress = 0;
    state.startX = 0;
    state.startY = 0;
    state.currentX = 0;
    state.currentY = 0;
    state.startTime = 0;
  }
  
  function attach(element: HTMLElement) {
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }
  
  return {
    state,
    attach
  };
}
