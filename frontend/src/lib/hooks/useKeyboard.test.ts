import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeyboard } from './useKeyboard';

describe('useKeyboard', () => {
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should register a simple keyboard shortcut', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', handler });

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should trigger handler on matching key press', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', handler });

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should handle Ctrl modifier', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', ctrl: true, handler });

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should not trigger without Ctrl when Ctrl is required', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', ctrl: true, handler });

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle Alt modifier', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'f', alt: true, handler });

    const event = new KeyboardEvent('keydown', { key: 'f', altKey: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should handle Shift modifier', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', shift: true, handler });

    const event = new KeyboardEvent('keydown', { key: 'k', shiftKey: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should handle Meta modifier', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', meta: true, handler });

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should handle multiple modifiers', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', ctrl: true, shift: true, handler });

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should prevent default by default', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', handler });

    const event = new KeyboardEvent('keydown', { key: 'k' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not prevent default when preventDefault is false', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'x', handler, preventDefault: false });

    const event = new KeyboardEvent('keydown', { key: 'x', cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(event);
    
    keyboard.cleanup();
  });

  it('should unregister a shortcut', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', handler });
    keyboard.unregister('k');

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should remove event listener when all shortcuts are unregistered', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'k', handler });
    keyboard.unregister('k');

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should cleanup all shortcuts', () => {
    const keyboard = useKeyboard();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    keyboard.register({ key: 'k', handler: handler1 });
    keyboard.register({ key: 'f', handler: handler2 });
    keyboard.cleanup();

    const event1 = new KeyboardEvent('keydown', { key: 'k' });
    const event2 = new KeyboardEvent('keydown', { key: 'f' });
    window.dispatchEvent(event1);
    window.dispatchEvent(event2);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalled();
  });

  it('should handle case-insensitive keys', () => {
    const keyboard = useKeyboard();
    const handler = vi.fn();

    keyboard.register({ key: 'K', handler });

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should register multiple shortcuts', () => {
    const keyboard = useKeyboard();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    keyboard.register({ key: 'k', handler: handler1 });
    keyboard.register({ key: 'f', handler: handler2 });

    const event1 = new KeyboardEvent('keydown', { key: 'k' });
    const event2 = new KeyboardEvent('keydown', { key: 'f' });
    
    window.dispatchEvent(event1);
    window.dispatchEvent(event2);

    expect(handler1).toHaveBeenCalledWith(event1);
    expect(handler2).toHaveBeenCalledWith(event2);
  });
});
