<script lang="ts">
  import { socketStore } from '$lib/stores/socket.svelte';
  import { filtersStore } from '$lib/stores/filters.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  import { searchStore } from '$lib/stores/search.svelte';
  import { sidebarStore } from '$lib/stores/sidebar.svelte';
  import { exportToJSON, exportToCSV } from '$lib/utils/export';
  import { SlidersHorizontal } from 'lucide-svelte';
  
  let showExportMenu = $state(false);
  let showSearchHistory = $state(false);
  let searchInputRef: HTMLInputElement;
  
  const connectionStatus = $derived(socketStore.connectionStatus);
  const hasActiveFilters = $derived(filtersStore.hasActiveFilters);
  
  const activeFilterCount = $derived.by(() => {
    let count = 0;
    const allEventTypes = [
      'post_created',
      'post_updated',
      'profile_updated',
      'profile_pinned',
      'follow_created',
      'follow_updated',
      'user_updated'
    ];
    
    if (filtersStore.users.length > 0) count++;
    if (filtersStore.eventTypes.length < allEventTypes.length) count++;
    if (filtersStore.keywords.length > 0) count++;
    
    return count;
  });
  
  const statusColor = $derived.by(() => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  });
  
  const statusText = $derived.by(() => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  });
  
  function toggleExportMenu() {
    showExportMenu = !showExportMenu;
  }
  
  function toggleRightSidebar() {
    sidebarStore.toggleRight();
  }
  
  function handleExportJSON() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    exportToJSON(eventsStore.filteredEvents, `twitter-events-${timestamp}.json`);
    showExportMenu = false;
  }
  
  function handleExportCSV() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    exportToCSV(eventsStore.filteredEvents, `twitter-events-${timestamp}.csv`);
    showExportMenu = false;
  }
  
  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchStore.setQuery(target.value);
  }
  
  function handleSearchFocus() {
    searchStore.setActive(true);
    if (searchStore.history.length > 0) {
      showSearchHistory = true;
    }
  }
  
  function handleSearchBlur() {
    setTimeout(() => {
      searchStore.setActive(false);
      showSearchHistory = false;
    }, 200);
  }
  
  function handleSearchSubmit(event: Event) {
    event.preventDefault();
    if (searchStore.query.trim()) {
      searchStore.addToHistory(searchStore.query);
      showSearchHistory = false;
    }
  }
  
  function handleHistoryItemClick(query: string) {
    searchStore.setQuery(query);
    showSearchHistory = false;
    if (searchInputRef) {
      searchInputRef.focus();
    }
  }
  
  function handleClearSearch() {
    searchStore.clear();
    if (searchInputRef) {
      searchInputRef.focus();
    }
  }
  
  function handleClearHistory() {
    searchStore.clearHistory();
    showSearchHistory = false;
  }
  
  function handleRemoveHistoryItem(query: string, event: Event) {
    event.stopPropagation();
    searchStore.removeFromHistory(query);
    if (searchStore.history.length === 0) {
      showSearchHistory = false;
    }
  }
</script>

<header class="header">
  <div class="header-content">
    <!-- Logo Section -->
    <div class="logo-section">
      <div class="logo-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-blue-400"
        >
          <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
        </svg>
      </div>
      <div class="logo-text">
        <h1 class="logo-title">Crypto Twitter Stream</h1>
        <p class="logo-subtitle">Real-time Alpha Monitor</p>
      </div>
    </div>
    
    <!-- Status and Controls Section -->
    <div class="controls-section">
      <!-- Search Input -->
      <div class="search-container">
        <form onsubmit={handleSearchSubmit} class="search-form">
          <div class="search-input-wrapper">
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
              class="search-icon"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              bind:this={searchInputRef}
              type="text"
              placeholder="Search events..."
              value={searchStore.query}
              oninput={handleSearchInput}
              onfocus={handleSearchFocus}
              onblur={handleSearchBlur}
              class="search-input"
              aria-label="Search events"
            />
            {#if searchStore.query}
              <button
                type="button"
                onclick={handleClearSearch}
                class="search-clear"
                aria-label="Clear search"
              >
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            {/if}
          </div>
        </form>
        
        {#if showSearchHistory && searchStore.history.length > 0}
          <div class="search-history">
            <div class="search-history-header">
              <span class="search-history-title">Recent Searches</span>
              <button
                type="button"
                onclick={handleClearHistory}
                class="search-history-clear"
                aria-label="Clear search history"
              >
                Clear All
              </button>
            </div>
            <div class="search-history-items">
              {#each searchStore.history as historyItem}
                <div class="search-history-item">
                  <button
                    type="button"
                    onclick={() => handleHistoryItemClick(historyItem)}
                    class="search-history-item-button"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span class="search-history-text">{historyItem}</span>
                  </button>
                  <button
                    type="button"
                    onclick={(e) => handleRemoveHistoryItem(historyItem, e)}
                    class="search-history-remove"
                    aria-label="Remove from history"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Connection Status Indicator -->
      <div class="status-indicator" role="status" aria-live="polite" aria-label="Connection status: {statusText}">
        <div class="status-dot {statusColor}"></div>
        <span class="status-text">{statusText}</span>
      </div>
      
      <!-- Filter Indicator -->
      {#if hasActiveFilters}
        <div class="filter-indicator" role="status" aria-label="Filters are currently active">
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
          <span class="filter-badge">{activeFilterCount}</span>
        </div>
      {/if}
      
      <!-- Export Button -->
      <div class="export-container">
        <button
          class="export-button"
          onclick={toggleExportMenu}
          aria-label="Export events"
          aria-expanded={showExportMenu}
        >
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export</span>
        </button>
        
        {#if showExportMenu}
          <div class="export-menu">
            <button
              class="export-menu-item"
              onclick={handleExportJSON}
              aria-label="Export as JSON"
            >
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              Export as JSON
            </button>
            <button
              class="export-menu-item"
              onclick={handleExportCSV}
              aria-label="Export as CSV"
            >
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Export as CSV
            </button>
          </div>
        {/if}
      </div>
      
      <!-- Right Sidebar Toggle -->
      <button
        class="sidebar-toggle-button"
        class:keyboard-active={sidebarStore.keyboardShortcutActive === 'right'}
        onclick={toggleRightSidebar}
        aria-label="Toggle filters and statistics sidebar"
        aria-pressed={!sidebarStore.rightCollapsed}
        title="Toggle Filters & Stats (Ctrl+F)"
      >
        <SlidersHorizontal size={20} />
      </button>
    </div>
  </div>
</header>

<style>
  .header {
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100%;
    /* Glassmorphism effect */
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    background: rgba(15, 23, 42, 0.85);
    border-bottom: 1px solid rgba(59, 130, 246, 0.2);
    /* Layered shadows for depth */
    box-shadow: 
      0 4px 6px rgba(0, 0, 0, 0.1),
      0 1px 3px rgba(0, 0, 0, 0.08),
      inset 0 -1px 0 rgba(255, 255, 255, 0.05);
  }
  
  .header-content {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto;
    align-items: center;
    max-width: 1920px;
    margin: 0 auto;
    padding: 1rem 1.5rem;
    gap: 1rem 2rem;
  }
  
  /* Logo Section */
  .logo-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    grid-column: 1;
    grid-row: 1;
  }
  
  /* Sidebar Toggle Buttons */
  .sidebar-toggle-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    position: relative;
  }
  
  .sidebar-toggle-button:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    transform: scale(1.05);
  }
  
  .sidebar-toggle-button:focus {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
  }
  
  .sidebar-toggle-button[aria-pressed="true"] {
    background: rgba(59, 130, 246, 0.25);
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
  
  /* Keyboard shortcut visual feedback */
  .sidebar-toggle-button.keyboard-active {
    animation: keyboardPulse 0.3s ease-out;
  }
  
  @keyframes keyboardPulse {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }
  
  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
    transition: all 0.3s ease;
  }
  
  .logo-icon:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.6);
  }
  
  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .logo-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #60a5fa;
    margin: 0;
  }
  
  .logo-subtitle {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
  }
  
  /* Controls Section */
  .controls-section {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    flex-wrap: wrap;
    grid-column: 2;
    grid-row: 1;
  }
  
  /* Search Container */
  .search-container {
    position: relative;
    width: 100%;
    max-width: 500px;
    flex-shrink: 1;
    min-width: 200px;
  }
  
  .search-form {
    width: 100%;
  }
  
  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .search-icon {
    position: absolute;
    left: 0.75rem;
    color: #8b98a5;
    pointer-events: none;
  }
  
  .search-input {
    width: 100%;
    padding: 0.5rem 2.5rem 0.5rem 2.5rem;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #334155;
    color: #f1f5f9;
    font-size: 0.875rem;
    outline: none;
    transition: all 0.3s ease;
  }
  
  .search-input::placeholder {
    color: #94a3b8;
  }
  
  .search-input:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(59, 130, 246, 0.5);
  }
  
  .search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }
  
  .search-clear {
    position: absolute;
    right: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: #8b98a5;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }
  
  .search-clear:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
  
  .search-clear:focus {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }
  
  .search-history {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.98);
    border: 1px solid #334155;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px);
    overflow: hidden;
    z-index: 100;
    animation: slideDown 0.2s ease-out;
  }
  
  .search-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #334155;
  }
  
  .search-history-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .search-history-clear {
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: #3b82f6;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }
  
  .search-history-clear:hover {
    background: rgba(59, 130, 246, 0.1);
  }
  
  .search-history-clear:focus {
    background: rgba(59, 130, 246, 0.15);
  }
  
  .search-history-items {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .search-history-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
  }
  
  .search-history-item:not(:last-child) {
    border-bottom: 1px solid rgba(51, 65, 85, 0.3);
  }
  
  .search-history-item-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: #f1f5f9;
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }
  
  .search-history-item-button:hover {
    background: rgba(59, 130, 246, 0.1);
  }
  
  .search-history-item-button:focus {
    background: rgba(59, 130, 246, 0.15);
  }
  
  .search-history-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .search-history-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-right: 1rem;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: #8b98a5;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    opacity: 0;
  }
  
  .search-history-item:hover .search-history-remove {
    opacity: 1;
  }
  
  .search-history-remove:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
  
  .search-history-remove:focus {
    opacity: 1;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
  
  /* Connection Status */
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #334155;
    transition: all 0.3s ease;
    white-space: nowrap;
    flex-shrink: 0;
    min-width: fit-content;
  }
  
  .status-indicator:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(59, 130, 246, 0.5);
  }
  
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .status-dot.bg-green-500 {
    background-color: #22c55e;
    animation: statusPulse 2s ease-in-out infinite;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  
  .status-dot.bg-yellow-500 {
    background-color: #eab308;
    animation: statusPulse 2s ease-in-out infinite;
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.7);
  }
  
  .status-dot.bg-red-500 {
    background-color: #ef4444;
  }
  
  .status-dot.bg-gray-500 {
    background-color: #6b7280;
  }
  
  @keyframes statusPulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
      box-shadow: 0 0 0 0 currentColor;
    }
    50% {
      opacity: 0.8;
      transform: scale(1.2);
      box-shadow: 0 0 0 4px transparent;
    }
  }
  
  .status-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #f1f5f9;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .status-indicator:hover .status-text {
    opacity: 1;
  }
  
  /* Filter Indicator */
  .filter-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.3s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .filter-indicator:hover {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    transform: translateY(-1px);
  }
  
  .filter-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.5rem;
    border-radius: 9999px;
    background: rgba(59, 130, 246, 0.3);
    font-size: 0.75rem;
    font-weight: 700;
  }
  
  /* Export Button */
  .export-container {
    position: relative;
    flex-shrink: 0;
  }
  
  .export-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    outline: none;
    white-space: nowrap;
  }
  
  .export-button:hover {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    transform: translateY(-1px);
  }
  
  .export-button:focus {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
  }
  
  .export-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    min-width: 180px;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.98);
    border: 1px solid #334155;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px);
    overflow: hidden;
    z-index: 100;
    animation: slideDown 0.2s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .export-menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: #f1f5f9;
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }
  
  .export-menu-item:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
  
  .export-menu-item:focus {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }
  
  .export-menu-item:not(:last-child) {
    border-bottom: 1px solid #334155;
  }
  
  /* Responsive Design */
  @media (max-width: 1200px) {
    .header-content {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
      gap: 1rem;
    }
    
    .logo-section {
      grid-column: 1;
      grid-row: 1;
    }
    
    .controls-section {
      grid-column: 1;
      grid-row: 2;
      justify-content: flex-start;
    }
  }
  
  @media (max-width: 768px) {
    .header-content {
      padding: 1rem;
    }
    
    .controls-section {
      gap: 0.5rem;
    }
    
    .search-container {
      width: 100%;
      max-width: 100%;
      order: -1;
      flex-basis: 100%;
    }
    
    .logo-title {
      font-size: 1rem;
    }
    
    .logo-subtitle {
      font-size: 0.625rem;
    }
  }
</style>
