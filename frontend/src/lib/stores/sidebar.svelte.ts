import { debounce } from '$lib/utils/debounce';
import { throttle } from '$lib/utils/throttle';

const STORAGE_KEY = 'dashboard-sidebar-state';
const MOBILE_BREAKPOINT = 768;
const STORAGE_DEBOUNCE_MS = 500;
const RESIZE_THROTTLE_MS = 100;

interface SidebarState {
  rightCollapsed: boolean;
}

class SidebarStore {
  rightCollapsed = $state<boolean>(false);
  private viewportWidth = $state<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  private previousDesktopState: { right: boolean } | null = null;
  
  // Keyboard shortcut visual feedback
  keyboardShortcutActive = $state<string | null>(null);
  
  // Computed states
  anyCollapsed = $derived(this.rightCollapsed);
  isMobile = $derived(this.viewportWidth < MOBILE_BREAKPOINT);
  
  private debouncedSave = debounce(() => this.saveToStorage(), STORAGE_DEBOUNCE_MS);
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
      this.setupKeyboardShortcuts();
      this.setupViewportTracking();
    }
  }
  
  toggleRight() {
    this.rightCollapsed = !this.rightCollapsed;
    this.showKeyboardFeedback('right');
    this.debouncedSave();
  }
  
  private showKeyboardFeedback(action: string) {
    this.keyboardShortcutActive = action;
    setTimeout(() => {
      this.keyboardShortcutActive = null;
    }, 300);
  }
  
  private setupKeyboardShortcuts() {
    if (typeof window === 'undefined') return;
    
    this.keyboardHandler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      // Ctrl+F (or Cmd+F on Mac) - Toggle right sidebar
      // Note: This might conflict with browser's find, but per requirements
      if (modKey && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        this.toggleRight();
      }
    };
    
    window.addEventListener('keydown', this.keyboardHandler);
  }
  
  private setupViewportTracking() {
    if (typeof window === 'undefined') return;
    
    // Throttled resize handler (100ms)
    this.resizeHandler = throttle(() => {
      const newWidth = window.innerWidth;
      const wasMobile = this.viewportWidth < MOBILE_BREAKPOINT;
      const isMobileNow = newWidth < MOBILE_BREAKPOINT;
      
      this.viewportWidth = newWidth;
      
      // Auto-collapse on mobile
      if (!wasMobile && isMobileNow) {
        // Transitioning to mobile - save desktop state and collapse
        this.previousDesktopState = {
          right: this.rightCollapsed
        };
        this.rightCollapsed = true;
      }
      
      // Restore state on desktop
      if (wasMobile && !isMobileNow && this.previousDesktopState) {
        // Transitioning to desktop - restore previous state
        this.rightCollapsed = this.previousDesktopState.right;
        this.previousDesktopState = null;
      }
    }, RESIZE_THROTTLE_MS);
    
    window.addEventListener('resize', this.resizeHandler);
  }
  
  private saveToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const state: SidebarState = {
        rightCollapsed: this.rightCollapsed
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save sidebar state to localStorage:', e);
    }
  }
  
  private loadFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: SidebarState = JSON.parse(stored);
        
        // Validate the stored state
        if (typeof state.rightCollapsed === 'boolean') {
          this.rightCollapsed = state.rightCollapsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load sidebar state from localStorage:', e);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  
  // Cleanup method for testing
  destroy() {
    if (typeof window !== 'undefined') {
      if (this.keyboardHandler) {
        window.removeEventListener('keydown', this.keyboardHandler);
      }
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }
    }
  }
}

export const sidebarStore = new SidebarStore();
