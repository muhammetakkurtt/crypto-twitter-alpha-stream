/**
 * Keyboard shortcut hook for handling keyboard events
 * Supports modifier keys (Ctrl, Alt, Shift, Meta)
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export interface UseKeyboardResult {
  register: (shortcut: KeyboardShortcut) => void;
  unregister: (key: string) => void;
  cleanup: () => void;
}

export function useKeyboard(): UseKeyboardResult {
  const shortcuts = new Map<string, KeyboardShortcut>();

  function getShortcutKey(shortcut: KeyboardShortcut): string {
    const modifiers = [];
    if (shortcut.ctrl) modifiers.push('ctrl');
    if (shortcut.alt) modifiers.push('alt');
    if (shortcut.shift) modifiers.push('shift');
    if (shortcut.meta) modifiers.push('meta');
    return [...modifiers, shortcut.key.toLowerCase()].join('+');
  }

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');
    
    const shortcutKey = [...modifiers, key].join('+');
    const shortcut = shortcuts.get(shortcutKey);

    if (shortcut) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }
      shortcut.handler(event);
    }
  }

  function register(shortcut: KeyboardShortcut) {
    const key = getShortcutKey(shortcut);
    shortcuts.set(key, shortcut);
    
    if (shortcuts.size === 1) {
      window.addEventListener('keydown', handleKeyDown);
    }
  }

  function unregister(key: string) {
    shortcuts.delete(key.toLowerCase());
    
    if (shortcuts.size === 0) {
      window.removeEventListener('keydown', handleKeyDown);
    }
  }

  function cleanup() {
    shortcuts.clear();
    window.removeEventListener('keydown', handleKeyDown);
  }

  return {
    register,
    unregister,
    cleanup
  };
}
