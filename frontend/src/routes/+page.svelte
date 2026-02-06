<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { socketStore } from '$lib/stores/socket.svelte';
  import { filtersStore } from '$lib/stores/filters.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  import { toastStore } from '$lib/stores/toast.svelte';
  import { sidebarStore } from '$lib/stores/sidebar.svelte';
  import { useKeyboard } from '$lib/hooks/useKeyboard';
  import Header from '$lib/components/Header.svelte';
  import MainLayout from '$lib/components/MainLayout.svelte';
  import EventFeed from '$lib/components/EventFeed.svelte';
  import UserList from '$lib/components/UserList.svelte';
  import RightSidebar from '$lib/components/RightSidebar.svelte';
  import Toast from '$lib/components/Toast.svelte';
  
  let errorMessage = $state<string | null>(null);
  let hasError = $state(false);
  let showShortcutsHelp = $state(false);
  let sidebarAnnouncement = $state<string>('');
  let previousRightState = $state<boolean>(false);
  
  const keyboard = useKeyboard();
  
  // Watch sidebar state changes for ARIA announcements
  $effect(() => {
    const rightChanged = previousRightState !== sidebarStore.rightCollapsed;
    
    if (rightChanged) {
      sidebarAnnouncement = sidebarStore.rightCollapsed 
        ? 'Right sidebar closed. Filters and statistics hidden.' 
        : 'Right sidebar opened. Filters and statistics visible.';
    }
    
    // Update previous state
    previousRightState = sidebarStore.rightCollapsed;
  });
  
  onMount(() => {
    try {
      socketStore.connect();
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : 'Failed to connect to server';
      toastStore.error(errorMessage);
      console.error('Socket connection error:', error);
    }
    
    // Register keyboard shortcuts
    keyboard.register({
      key: 'k',
      ctrl: true,
      handler: () => {
        filtersStore.clearAll();
      }
    });
    
    keyboard.register({
      key: 'f',
      ctrl: true,
      handler: () => {
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      }
    });
    
    keyboard.register({
      key: 'e',
      ctrl: true,
      handler: () => {
        exportEvents();
      }
    });
    
    keyboard.register({
      key: 'c',
      ctrl: true,
      shift: true,
      handler: () => {
        eventsStore.clear();
      }
    });
    
    keyboard.register({
      key: '?',
      shift: true,
      handler: () => {
        showShortcutsHelp = !showShortcutsHelp;
      }
    });
    
    keyboard.register({
      key: 'Escape',
      handler: () => {
        if (showShortcutsHelp) {
          showShortcutsHelp = false;
        }
      },
      preventDefault: false
    });
  });
  
  onDestroy(() => {
    try {
      socketStore.disconnect();
      keyboard.cleanup();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to disconnect';
      toastStore.error(errorMsg);
      console.error('Socket disconnection error:', error);
    }
  });
  
  function exportEvents() {
    try {
      const events = eventsStore.events;
      const dataStr = JSON.stringify(events, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `crypto-twitter-events-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toastStore.success('Events exported successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to export events';
      toastStore.error(errorMsg);
      console.error('Export error:', error);
    }
  }
  
  function closeShortcutsHelp() {
    showShortcutsHelp = false;
  }
</script>

<svelte:head>
  <title>Crypto Twitter Stream - Real-time Alpha Monitor</title>
  <meta name="description" content="Real-time crypto Twitter event streaming dashboard" />
</svelte:head>

{#if hasError}
  <div class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 class="error-title">Something went wrong</h1>
      <p class="error-message">{errorMessage || 'An unexpected error occurred'}</p>
      <button
        class="error-button"
        onclick={() => window.location.reload()}
        aria-label="Reload page to retry connection"
      >
        Reload Page
      </button>
    </div>
  </div>
{:else}
  <div class="app-container">
    <Toast />
    
    <!-- ARIA live region for sidebar state announcements -->
    <div 
      class="sr-only" 
      role="status" 
      aria-live="polite" 
      aria-atomic="true"
    >
      {sidebarAnnouncement}
    </div>
    
    <Header />
    
    <!-- Overlay Sidebars (outside MainLayout, at root level) -->
    <UserList />
    <RightSidebar />
    
    <!-- Main Content Area -->
    <main id="main-content" aria-label="Main content">
      <MainLayout>
        {#snippet centerPanel()}
          <section aria-label="Event feed">
            <EventFeed />
          </section>
        {/snippet}
      </MainLayout>
    </main>
    
    <!-- Keyboard Shortcuts Help Modal -->
    {#if showShortcutsHelp}
      <div 
        class="shortcuts-modal-overlay" 
        onclick={closeShortcutsHelp}
        onkeydown={(e) => e.key === 'Enter' && closeShortcutsHelp()}
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="shortcuts-title"
        tabindex="-1"
      >
        <div 
          class="shortcuts-modal" 
          role="document"
        >
          <div class="shortcuts-header">
            <h2 id="shortcuts-title" class="shortcuts-title">Keyboard Shortcuts</h2>
            <button
              class="shortcuts-close"
              onclick={closeShortcutsHelp}
              aria-label="Close shortcuts help"
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
          </div>
          
          <div class="shortcuts-content">
            <div class="shortcuts-section">
              <h3 class="shortcuts-section-title">Sidebars</h3>
              <div class="shortcuts-list">
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>F</kbd>
                  </div>
                  <div class="shortcut-description">Toggle right sidebar (filters & stats)</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Esc</kbd>
                  </div>
                  <div class="shortcut-description">Close open sidebar</div>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3 class="shortcuts-section-title">General</h3>
              <div class="shortcuts-list">
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Shift</kbd> + <kbd>?</kbd>
                  </div>
                  <div class="shortcut-description">Show/hide this help</div>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3 class="shortcuts-section-title">Filters</h3>
              <div class="shortcuts-list">
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>K</kbd>
                  </div>
                  <div class="shortcut-description">Clear all filters</div>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3 class="shortcuts-section-title">Events</h3>
              <div class="shortcuts-list">
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>E</kbd>
                  </div>
                  <div class="shortcut-description">Export events to JSON</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>
                  </div>
                  <div class="shortcut-description">Clear all events</div>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3 class="shortcuts-section-title">Navigation</h3>
              <div class="shortcuts-list">
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Tab</kbd>
                  </div>
                  <div class="shortcut-description">Navigate forward</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Shift</kbd> + <kbd>Tab</kbd>
                  </div>
                  <div class="shortcut-description">Navigate backward</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>↑</kbd> / <kbd>↓</kbd>
                  </div>
                  <div class="shortcut-description">Navigate user list</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    <kbd>Enter</kbd>
                  </div>
                  <div class="shortcut-description">Activate focused item</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background: #0f172a;
    color: #f1f5f9;
    overflow-x: hidden;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  .app-container {
    min-height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  /* Screen reader only class for ARIA live region */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  
  /* Main content area with proper z-index */
  #main-content {
    position: relative;
    z-index: 1;
  }
  
  /* Z-index stacking context:
   * - Shortcuts modal: z-index 100 (defined below)
   * - Header: z-index 100 (defined in Header.svelte)
   * - Sidebars: z-index 50 (defined in UserList.svelte and RightSidebar.svelte)
   * - Sidebar backdrops: z-index 49 (defined in UserList.svelte and RightSidebar.svelte)
   * - Floating toggles: z-index 48 (defined in UserList.svelte and RightSidebar.svelte)
   * - Main content: z-index 1 (defined above)
   */
  
  /* Error Boundary Styles */
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    width: 100%;
    padding: 2rem;
    background: #0f172a;
  }
  
  .error-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    max-width: 500px;
    padding: 3rem;
    border-radius: var(--radius-xl);
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(239, 68, 68, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    text-align: center;
  }
  
  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.1);
    border: 2px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  
  .error-title {
    font-size: 2rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0;
  }
  
  .error-message {
    font-size: 1rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0;
  }
  
  .error-button {
    padding: 0.875rem 2rem;
    border-radius: var(--radius-md);
    background: #3b82f6;
    border: none;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .error-button:hover {
    background: #60a5fa;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  
  .error-button:active {
    transform: translateY(0);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .error-content {
      padding: 2rem;
    }
    
    .error-icon {
      width: 100px;
      height: 100px;
    }
    
    .error-icon svg {
      width: 48px;
      height: 48px;
    }
    
    .error-title {
      font-size: 1.5rem;
    }
    
    .error-message {
      font-size: 0.875rem;
    }
  }
  
  /* Keyboard Shortcuts Modal */
  .shortcuts-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .shortcuts-modal {
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    background: rgba(30, 41, 59, 0.98);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--radius-xl);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: slideIn 0.3s ease-out;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.5);
  }
  
  .shortcuts-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #3b82f6;
    margin: 0;
  }
  
  .shortcuts-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .shortcuts-close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    transform: scale(1.05);
  }
  
  .shortcuts-close:focus {
    outline: 3px solid #ef4444;
    outline-offset: 2px;
  }
  
  .shortcuts-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .shortcuts-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .shortcuts-section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #94a3b8;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: rgba(30, 41, 59, 0.5);
    border-radius: var(--radius-md);
    border: 1px solid rgba(51, 65, 85, 0.5);
    transition: all 0.2s ease;
  }
  
  .shortcut-item:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }
  
  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #94a3b8;
  }
  
  .shortcut-keys kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    padding: 0.25rem 0.5rem;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--radius-sm);
    color: #3b82f6;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  .shortcut-description {
    font-size: 0.875rem;
    color: #f1f5f9;
    text-align: right;
  }
  
  @media (max-width: 768px) {
    .shortcuts-modal {
      width: 95%;
      max-height: 90vh;
    }
    
    .shortcuts-header {
      padding: 1rem;
    }
    
    .shortcuts-title {
      font-size: 1.25rem;
    }
    
    .shortcuts-content {
      padding: 1rem;
      gap: 1.5rem;
    }
    
    .shortcut-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    
    .shortcut-description {
      text-align: left;
    }
  }
</style>
