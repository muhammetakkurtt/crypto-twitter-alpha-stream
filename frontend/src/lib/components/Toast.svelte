<script lang="ts">
  import { toastStore, type Toast } from '$lib/stores/toast.svelte';
  import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-svelte';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  
  const toasts = $derived(toastStore.toasts);
  
  function getIconComponent(type: Toast['type']) {
    switch (type) {
      case 'success': return CheckCircle;
      case 'error': return AlertCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
    }
  }
  
  function getColorClasses(type: Toast['type']) {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/50 text-green-400';
      case 'error': return 'bg-red-500/10 border-red-500/50 text-red-400';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400';
      case 'info': return 'bg-blue-500/10 border-blue-500/50 text-blue-400';
    }
  }
</script>

<div class="toast-container">
  {#each toasts as toast (toast.id)}
    {@const IconComponent = getIconComponent(toast.type)}
    <div
      class="toast {getColorClasses(toast.type)}"
      transition:fly={{ y: -20, duration: 300, easing: quintOut }}
      role="alert"
      aria-live="polite"
    >
      <div class="toast-icon">
        <IconComponent size={20} />
      </div>
      <div class="toast-message">
        {toast.message}
      </div>
      <button
        class="toast-close"
        onclick={() => toastStore.remove(toast.id)}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  }
  
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
    min-width: 300px;
    max-width: 400px;
  }
  
  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  
  .toast-message {
    flex: 1;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  
  .toast-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .toast-close:hover {
    opacity: 1;
  }
  
  .toast-close:focus {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
</style>
