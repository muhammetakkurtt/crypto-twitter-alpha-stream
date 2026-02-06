/**
 * Focus trap hook for accessible modal/sidebar behavior
 * Traps focus within a container when active
 */

interface FocusTrapOptions {
  enabled: boolean;
  onEscape?: () => void;
}

export function useFocusTrap(options: FocusTrapOptions) {
  let container: HTMLElement | null = null;
  let previouslyFocusedElement: HTMLElement | null = null;
  
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');
  
  function getFocusableElements(): HTMLElement[] {
    if (!container) return [];
    
    const elements = Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelectors)
    );
    
    return elements.filter(el => {
      return el.offsetParent !== null && !el.hasAttribute('disabled');
    });
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    if (!options.enabled || !container) return;
    
    // Handle Escape key
    if (e.key === 'Escape' && options.onEscape) {
      e.preventDefault();
      options.onEscape();
      return;
    }
    
    // Handle Tab key for focus trap
    if (e.key === 'Tab') {
      const focusableElements = getFocusableElements();
      
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // Shift + Tab (backward)
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      }
      // Tab (forward)
      else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }
  
  function activate(element: HTMLElement) {
    container = element;
    
    // Save currently focused element
    previouslyFocusedElement = document.activeElement as HTMLElement;
    
    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Focus first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        focusableElements[0].focus();
      }, 50);
    }
  }
  
  function deactivate() {
    // Remove keyboard listener
    document.removeEventListener('keydown', handleKeyDown);
    
    // Restore focus to previously focused element
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
    }
    
    container = null;
    previouslyFocusedElement = null;
  }
  
  return {
    activate,
    deactivate
  };
}
