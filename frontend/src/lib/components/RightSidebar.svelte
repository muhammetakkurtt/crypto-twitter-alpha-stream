<script lang="ts">
  import { onMount } from 'svelte';
  import { sidebarStore } from '$lib/stores/sidebar.svelte';
  import { useSwipeGesture } from '$lib/hooks/useSwipeGesture';
  import { useFocusTrap } from '$lib/hooks/useFocusTrap';
  import FilterPanel from './FilterPanel.svelte';
  import StatsPanel from './StatsPanel.svelte';
  import SubscriptionPanel from './SubscriptionPanel.svelte';
  import SidebarToggle from './SidebarToggle.svelte';
  import { X } from 'lucide-svelte';
  
  const isOpen = $derived(!sidebarStore.rightCollapsed);
  let swipeProgress = $state(0);
  let sidebarElement: HTMLElement;
  let hasBeenOpened = $state(false);
  let backdropOpacity = $state(0);
  
  // Lazy load: only render content after first open
  $effect(() => {
    if (isOpen && !hasBeenOpened) {
      hasBeenOpened = true;
    }
  });
  
  function handleClose() {
    sidebarStore.toggleRight();
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
  
  // Focus trap for accessibility
  const focusTrap = useFocusTrap({
    enabled: false, // Controlled via activate/deactivate
    onEscape: handleClose
  });
  
  // Activate/deactivate focus trap when sidebar opens/closes
  $effect(() => {
    if (isOpen && sidebarElement) {
      focusTrap.activate(sidebarElement);
    } else {
      focusTrap.deactivate();
    }
  });
  
  // Smooth backdrop fade with requestAnimationFrame
  $effect(() => {
    if (isOpen) {
      let rafId: number;
      const startTime = performance.now();
      const duration = 300; // 300ms fade in
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        backdropOpacity = progress;
        
        if (progress < 1) {
          rafId = requestAnimationFrame(animate);
        }
      };
      
      rafId = requestAnimationFrame(animate);
      
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
      };
    } else {
      backdropOpacity = 0;
      return undefined;
    }
  });
  
  // Swipe gesture support for mobile
  const swipeGesture = useSwipeGesture({
    onSwipeLeft: () => {
      if (sidebarStore.rightCollapsed) {
        sidebarStore.toggleRight();
      }
    },
    onSwipeProgress: (progress) => {
      swipeProgress = progress;
    },
    enabled: sidebarStore.isMobile
  });
  
  onMount(() => {
    // Attach swipe gesture to document body for edge detection
    const cleanup = swipeGesture.attach(document.body);
    return cleanup;
  });
</script>

<!-- Backdrop -->
{#if isOpen}
  <div 
    class="sidebar-backdrop" 
    style="opacity: {backdropOpacity}"
    onclick={handleBackdropClick}
    role="presentation"
  ></div>
{/if}

<!-- Sidebar -->
<aside 
  bind:this={sidebarElement}
  class="right-sidebar" 
  class:open={isOpen}
  style="--swipe-progress: {swipeProgress}"
  aria-label="Controls sidebar"
  aria-hidden={!isOpen}
>
  <!-- Sidebar Header with Close Button -->
  <div class="sidebar-header">
    <h2 class="sidebar-title">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
      Controls
    </h2>
    <button
      class="close-button"
      onclick={handleClose}
      aria-label="Close sidebar"
      title="Close sidebar (Esc)"
    >
      <span class="close-text">Close</span>
      <X size={18} />
    </button>
  </div>

  <!-- Lazy load content: only render after first open -->
  {#if hasBeenOpened}
    <div class="sidebar-content">
      <!-- Global Subscription Section -->
      <section class="panel-section" aria-labelledby="global-subscription-heading">
        <h3 id="global-subscription-heading" class="section-heading">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          Global Subscription
          <span class="section-badge">Affects all outputs</span>
        </h3>
        <div class="panel-wrapper">
          <SubscriptionPanel />
        </div>
      </section>
      
      <div class="section-separator" role="separator" aria-hidden="true"></div>
      
      <!-- Local Filters Section -->
      <section class="panel-section" aria-labelledby="local-filters-heading">
        <h3 id="local-filters-heading" class="section-heading">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Local Filters
          <span class="section-badge">Dashboard view only</span>
        </h3>
        <div class="panel-wrapper">
          <FilterPanel />
        </div>
      </section>
      
      <div class="section-separator" role="separator" aria-hidden="true"></div>
      
      <!-- Statistics Section -->
      <section class="panel-section" aria-labelledby="statistics-heading">
        <h3 id="statistics-heading" class="section-heading">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Statistics
        </h3>
        <div class="panel-wrapper">
          <StatsPanel />
        </div>
      </section>
    </div>
  {:else}
    <!-- Placeholder for initial render -->
    <div class="sidebar-content">
      <div class="loading-placeholder">
        <div class="loading-text">Loading...</div>
      </div>
    </div>
  {/if}
</aside>

<!-- Floating Toggle Button (visible when closed) -->
{#if !isOpen}
  <div class="floating-toggle">
    <SidebarToggle 
      side="right"
      collapsed={sidebarStore.rightCollapsed}
      onToggle={() => sidebarStore.toggleRight()}
      ariaLabel="Open controls sidebar"
    />
  </div>
{/if}

<style>
  /* Backdrop - Subtle glassmorphism effect */
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    top: 80px;
    background: rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(2px);
    z-index: 49;
    /* Opacity controlled by requestAnimationFrame */
    transition: background 0.3s ease-out, backdrop-filter 0.3s ease-out;
  }
  
  /* Mobile: Increased backdrop opacity */
  @media (max-width: 768px) {
    .sidebar-backdrop {
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
    }
  }
  
  /* Sidebar Container - Modern Glassmorphism */
  .right-sidebar {
    position: fixed;
    right: 0;
    top: 80px;
    height: calc(100vh - 80px);
    width: 360px;
    /* Glassmorphism effect - semi-transparent with blur */
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    /* Subtle border with gradient for depth */
    border-left: 1px solid rgba(148, 163, 184, 0.1);
    /* Layered shadows for depth */
    box-shadow: 
      -4px 0 24px rgba(0, 0, 0, 0.2),
      -2px 0 8px rgba(0, 0, 0, 0.1),
      inset 1px 0 0 rgba(255, 255, 255, 0.05);
    z-index: 50;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
    /* Safe area insets for notched devices */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-right: env(safe-area-inset-right);
  }
  
  .right-sidebar.open {
    transform: translateX(0);
  }
  
  /* Follow-finger animation during swipe */
  @media (max-width: 768px) {
    .right-sidebar:not(.open) {
      transform: translateX(calc(100% - var(--swipe-progress, 0) * 100vw));
    }
  }
  
  /* Sidebar Header */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    background: rgba(30, 41, 59, 0.5);
    backdrop-filter: blur(8px);
  }
  
  .sidebar-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }
  
  .sidebar-title svg {
    color: #60a5fa;
  }
  
  /* Close Button - Integrated into header */
  .close-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md, 8px);
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #cbd5e1;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    background: rgba(148, 163, 184, 0.2);
    border-color: rgba(148, 163, 184, 0.4);
    color: #f1f5f9;
  }
  
  .close-button:active {
    transform: scale(0.98);
  }
  
  .close-button:focus {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }
  
  .close-button:focus:not(:focus-visible) {
    outline: none;
  }
  
  .close-text {
    display: inline;
  }
  
  /* Mobile: Hide text, show only icon */
  @media (max-width: 768px) {
    .sidebar-header {
      padding: 1rem;
    }
    
    .sidebar-title {
      font-size: 1rem;
      gap: 0.5rem;
    }
    
    .close-text {
      display: none;
    }
    
    .close-button {
      padding: 0.5rem;
      min-width: 36px;
      justify-content: center;
    }
  }
  
  /* Floating Toggle Button */
  .floating-toggle {
    position: fixed;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    z-index: 48;
    animation: slideInRight 0.3s ease-out;
  }
  
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }
  
  /* Sidebar Content */
  .sidebar-content {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: calc(100% - 60px); /* Account for header height */
    overflow-y: auto;
    padding: 0;
  }
  
  /* Panel Section */
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem 1rem;
  }
  
  /* Section Heading */
  .section-heading {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.875rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 0.5rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 0.5rem;
  }
  
  .section-heading svg {
    flex-shrink: 0;
    color: #60a5fa;
  }
  
  /* Section Badge */
  .section-badge {
    margin-left: auto;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-sm, 6px);
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0.025em;
    white-space: nowrap;
  }
  
  /* Section Separator */
  .section-separator {
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      rgba(148, 163, 184, 0.2) 20%,
      rgba(148, 163, 184, 0.2) 80%,
      transparent
    );
    margin: 0.5rem 1rem;
  }
  
  .sidebar-content::-webkit-scrollbar {
    width: 8px;
  }
  
  .sidebar-content::-webkit-scrollbar-track {
    background: rgba(22, 24, 28, 0.5);
    border-radius: 4px;
  }
  
  .sidebar-content::-webkit-scrollbar-thumb {
    background: rgba(47, 51, 54, 0.8);
    border-radius: 4px;
  }
  
  .sidebar-content::-webkit-scrollbar-thumb:hover {
    background: rgba(47, 51, 54, 1);
  }
  
  .panel-wrapper {
    flex-shrink: 0;
    padding: 0 0.5rem;
  }
  
  /* Loading Placeholder */
  .loading-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: rgba(139, 152, 165, 0.6);
  }
  
  .loading-text {
    font-size: 0.875rem;
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .right-sidebar {
      width: 100vw;
      /* Adjust height for safe areas on mobile */
      height: calc(100vh - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
    
    .sidebar-backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
    
    .panel-section {
      padding: 1rem 0.75rem;
    }
    
    .section-heading {
      font-size: 0.8125rem;
      gap: 0.5rem;
      padding: 0 0.25rem;
    }
    
    .section-badge {
      font-size: 0.5625rem;
      padding: 0.1875rem 0.5rem;
    }
    
    .section-separator {
      margin: 0.25rem 0.75rem;
    }
    
    .panel-wrapper {
      padding: 0 0.25rem;
    }
  }
</style>
