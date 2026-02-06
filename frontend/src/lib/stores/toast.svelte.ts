export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

class ToastStore {
  toasts = $state<Toast[]>([]);
  
  show(message: string, type: ToastType = 'info', duration: number = 3000) {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };
    
    this.toasts = [...this.toasts, toast];
    
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }
  
  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }
  
  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }
  
  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  }
  
  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }
  
  remove(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
  
  clear() {
    this.toasts = [];
  }
}

export const toastStore = new ToastStore();
