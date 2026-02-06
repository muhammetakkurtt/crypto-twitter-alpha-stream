import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toastStore } from './toast.svelte';

describe('ToastStore', () => {
  beforeEach(() => {
    toastStore.clear();
    vi.useFakeTimers();
  });

  it('should add a toast', () => {
    toastStore.show('Test message', 'info', 0);
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0].message).toBe('Test message');
    expect(toastStore.toasts[0].type).toBe('info');
  });

  it('should add success toast', () => {
    toastStore.success('Success message', 0);
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0].type).toBe('success');
  });

  it('should add error toast', () => {
    toastStore.error('Error message', 0);
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0].type).toBe('error');
  });

  it('should add warning toast', () => {
    toastStore.warning('Warning message', 0);
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0].type).toBe('warning');
  });

  it('should add info toast', () => {
    toastStore.info('Info message', 0);
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0].type).toBe('info');
  });

  it('should remove toast by id', () => {
    toastStore.show('Test 1', 'info', 0);
    toastStore.show('Test 2', 'info', 0);
    expect(toastStore.toasts).toHaveLength(2);
    
    const firstId = toastStore.toasts[0].id;
    toastStore.remove(firstId);
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0].message).toBe('Test 2');
  });

  it('should auto-remove toast after duration', () => {
    toastStore.show('Test message', 'info', 3000);
    expect(toastStore.toasts).toHaveLength(1);
    
    vi.advanceTimersByTime(3000);
    expect(toastStore.toasts).toHaveLength(0);
  });

  it('should clear all toasts', () => {
    toastStore.show('Test 1', 'info', 0);
    toastStore.show('Test 2', 'info', 0);
    toastStore.show('Test 3', 'info', 0);
    expect(toastStore.toasts).toHaveLength(3);
    
    toastStore.clear();
    expect(toastStore.toasts).toHaveLength(0);
  });

  it('should generate unique ids', () => {
    toastStore.show('Test 1', 'info', 0);
    toastStore.show('Test 2', 'info', 0);
    
    const ids = toastStore.toasts.map(t => t.id);
    expect(new Set(ids).size).toBe(2);
  });
});
