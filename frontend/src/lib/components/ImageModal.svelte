<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  
  let { 
    imageUrl,
    imageAlt = 'Full size image',
    onClose
  }: { 
    imageUrl: string;
    imageAlt?: string;
    onClose: () => void;
  } = $props();
  
  let modalElement: HTMLDivElement;
  let portalTarget: HTMLElement;
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === modalElement) {
      onClose();
    }
  }
  
  onMount(() => {
    // Create portal target at body level if it doesn't exist
    let target = document.getElementById('modal-portal');
    if (!target) {
      target = document.createElement('div');
      target.id = 'modal-portal';
      target.style.position = 'fixed';
      target.style.top = '0';
      target.style.left = '0';
      target.style.width = '100%';
      target.style.height = '100%';
      target.style.zIndex = '10000';
      target.style.pointerEvents = 'none';
      document.body.appendChild(target);
    }
    portalTarget = target;
    
    // Move modal to portal
    if (modalElement && portalTarget) {
      portalTarget.appendChild(modalElement);
      portalTarget.style.pointerEvents = 'auto';
    }
    
    return () => {
      if (portalTarget) {
        portalTarget.style.pointerEvents = 'none';
      }
    };
  });
  
  $effect(() => {
    document.addEventListener('keydown', handleKeydown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
    };
  });
</script>

<div 
  class="modal-overlay" 
  bind:this={modalElement}
  onclick={handleBackdropClick}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  transition:fade={{ duration: 200 }}
  role="dialog"
  aria-modal="true"
  aria-label="Image viewer"
  tabindex="-1"
>
  <button
    class="close-button"
    onclick={onClose}
    aria-label="Close image viewer"
    type="button"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
  
  <div class="image-container">
    <img 
      src={imageUrl} 
      alt={imageAlt}
      class="modal-image"
    />
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(4px);
    padding: 2rem;
  }
  
  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }
  
  .close-button:focus {
    outline: 3px solid rgba(59, 130, 246, 0.8);
    outline-offset: 2px;
  }
  
  .image-container {
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .modal-image {
    max-width: 100%;
    max-height: 90vh;
    object-fit: contain;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
  }
  
  /* Mobile Responsive */
  @media (max-width: 768px) {
    .modal-overlay {
      padding: 1rem;
    }
    
    .close-button {
      top: 0.5rem;
      right: 0.5rem;
      width: 2.5rem;
      height: 2.5rem;
    }
    
    .image-container {
      max-width: 95vw;
      max-height: 95vh;
    }
    
    .modal-image {
      max-height: 95vh;
    }
  }
</style>
