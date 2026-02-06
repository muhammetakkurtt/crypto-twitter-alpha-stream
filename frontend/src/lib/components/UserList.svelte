<script lang="ts">
  import { socketStore } from '$lib/stores/socket.svelte';
  import { filtersStore } from '$lib/stores/filters.svelte';
  import { sidebarStore } from '$lib/stores/sidebar.svelte';
  import { Search, UserCheck, User, X, Menu } from 'lucide-svelte';
  
  let searchQuery = $state('');
  let focusedIndex = $state(-1);
  let mobileOpen = $state(false);
  
  const activeUsers = $derived(socketStore.activeUsers);
  const isMobile = $derived(sidebarStore.isMobile);
  
  const filteredUsers = $derived.by(() => {
    if (!searchQuery.trim()) {
      return activeUsers;
    }
    
    const query = searchQuery.toLowerCase();
    return activeUsers.filter(username => 
      username.toLowerCase().includes(query)
    );
  });
  
  function isUserFiltered(username: string): boolean {
    return filtersStore.users.includes(username);
  }
  
  function handleUserClick(username: string) {
    filtersStore.toggleUser(username);
    focusedIndex = -1;
    // Close mobile sidebar after selection
    if (isMobile) {
      mobileOpen = false;
    }
  }
  
  function toggleMobileSidebar() {
    mobileOpen = !mobileOpen;
  }
  
  function closeMobileSidebar() {
    if (isMobile) {
      mobileOpen = false;
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (filteredUsers.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, filteredUsers.length - 1);
        scrollToFocused();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, -1);
        scrollToFocused();
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredUsers.length) {
          handleUserClick(filteredUsers[focusedIndex]);
        }
        break;
      case 'Escape':
        if (isMobile && mobileOpen) {
          e.preventDefault();
          closeMobileSidebar();
        }
        break;
    }
  }
  
  function scrollToFocused() {
    if (focusedIndex >= 0) {
      const element = document.querySelector(`[data-user-index="${focusedIndex}"]`);
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  
  function handleSearchFocus() {
    if (focusedIndex === -1 && filteredUsers.length > 0) {
      focusedIndex = 0;
    }
  }
</script>

<!-- Mobile Toggle Button -->
{#if isMobile}
  <button
    class="mobile-toggle"
    onclick={toggleMobileSidebar}
    aria-label="Toggle user list"
    aria-expanded={mobileOpen}
  >
    <Menu size={24} />
  </button>
{/if}

<!-- Mobile Backdrop -->
{#if isMobile && mobileOpen}
  <div 
    class="mobile-backdrop" 
    onclick={closeMobileSidebar}
    onkeydown={(e) => e.key === 'Enter' && closeMobileSidebar()}
    role="button"
    tabindex="-1"
    aria-label="Close user list"
  ></div>
{/if}

<!-- Sidebar -->
<aside 
  class="user-list-sidebar"
  class:mobile-open={isMobile && mobileOpen}
  aria-label="Active users - fixed sidebar"
>
  <div class="user-list">
    <div class="search-container">
      {#if isMobile}
        <button
          class="mobile-close"
          onclick={closeMobileSidebar}
          aria-label="Close user list"
        >
          <X size={20} />
        </button>
      {/if}
      <div class="search-input-wrapper">
        <Search class="search-icon" size={18} />
        <input
          bind:value={searchQuery}
          type="text"
          placeholder="Search users..."
          class="search-input"
          onkeydown={handleKeydown}
          onfocus={handleSearchFocus}
          aria-label="Search users"
        />
      </div>
    </div>
    
    <div class="users-container">
      {#if filteredUsers.length === 0}
        <div class="empty-state">
          <User size={32} class="empty-icon" />
          <p class="empty-text">
            {searchQuery ? 'No users found' : 'No users yet'}
          </p>
        </div>
      {:else}
        <div class="users-list">
          {#each filteredUsers as username, index (username)}
            <button
              class="user-item"
              class:filtered={isUserFiltered(username)}
              class:focused={index === focusedIndex}
              data-user-index={index}
              onclick={() => handleUserClick(username)}
              aria-label={`Filter by ${username}`}
              aria-pressed={isUserFiltered(username)}
            >
              <div class="user-info">
                <div class="user-icon">
                  {#if isUserFiltered(username)}
                    <UserCheck size={16} />
                  {:else}
                    <User size={16} />
                  {/if}
                </div>
                <div class="user-details">
                  <div class="user-username">@{username}</div>
                </div>
              </div>
              {#if isUserFiltered(username)}
                <div class="filter-indicator" aria-hidden="true">
                  <div class="indicator-dot"></div>
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</aside>

<style>
  /* Mobile Toggle Button */
  .mobile-toggle {
    position: fixed;
    left: 1rem;
    top: 90px;
    z-index: 55;
    width: 48px;
    height: 48px;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(29, 155, 240, 0.9);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  .mobile-toggle:hover {
    background: rgba(29, 155, 240, 1);
    transform: scale(1.05);
  }
  
  .mobile-toggle:active {
    transform: scale(0.95);
  }
  
  /* Mobile Backdrop - Glassmorphism */
  .mobile-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 59;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: fadeIn 0.3s ease;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  /* Mobile Close Button */
  .mobile-close {
    position: absolute;
    right: 1rem;
    top: 1rem;
    width: 36px;
    height: 36px;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 50%;
    color: rgba(239, 68, 68, 0.9);
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
  }
  
  .mobile-close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: rgba(239, 68, 68, 1);
  }
  
  /* Sidebar Container - Fixed positioning with Glassmorphism */
  .user-list-sidebar {
    position: fixed;
    left: 0;
    top: 80px;
    height: calc(100vh - 80px);
    width: 320px;
    /* Glassmorphism effect - semi-transparent with blur */
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    /* Subtle border with gradient for depth */
    border-right: 1px solid rgba(148, 163, 184, 0.1);
    /* Layered shadows for depth */
    box-shadow: 
      4px 0 24px rgba(0, 0, 0, 0.2),
      2px 0 8px rgba(0, 0, 0, 0.1),
      inset -1px 0 0 rgba(255, 255, 255, 0.05);
    z-index: 50;
    /* Safe area insets for notched devices */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
  }
  
  /* User List Content */
  .user-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  
  .search-container {
    padding: 1rem;
    border-bottom: 1px solid #334155;
    background: rgba(59, 130, 246, 0.05);
    flex-shrink: 0;
  }
  
  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: rgba(139, 152, 165, 0.8);
    pointer-events: none;
  }
  
  .search-input {
    width: 100%;
    padding: 0.75rem 0.75rem 0.75rem 2.5rem;
    background: rgba(22, 24, 28, 0.8);
    border: 1px solid rgba(47, 51, 54, 0.5);
    border-radius: var(--radius-md);
    color: #e7e9ea;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }
  
  .search-input::placeholder {
    color: rgba(139, 152, 165, 0.6);
  }
  
  .search-input:focus {
    outline: none;
    border-color: rgba(29, 155, 240, 0.5);
    background: rgba(22, 24, 28, 0.95);
    box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.1);
  }
  
  .users-container {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }
  
  .users-container::-webkit-scrollbar {
    width: 8px;
  }
  
  .users-container::-webkit-scrollbar-track {
    background: rgba(22, 24, 28, 0.5);
    border-radius: 4px;
  }
  
  .users-container::-webkit-scrollbar-thumb {
    background: rgba(47, 51, 54, 0.8);
    border-radius: 4px;
  }
  
  .users-container::-webkit-scrollbar-thumb:hover {
    background: rgba(47, 51, 54, 1);
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: rgba(139, 152, 165, 0.6);
  }
  
  .empty-state :global(.empty-icon) {
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .empty-text {
    font-size: 0.875rem;
    margin: 0;
  }
  
  .users-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .user-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: rgba(22, 24, 28, 0.5);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
    /* Ensure touch target is at least 44px on mobile */
    min-height: 44px;
  }
  
  .user-item:hover {
    background: rgba(29, 155, 240, 0.1);
    border-color: rgba(29, 155, 240, 0.3);
    transform: translateX(2px);
  }
  
  .user-item.focused {
    background: rgba(29, 155, 240, 0.15);
    border-color: rgba(29, 155, 240, 0.5);
    box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.1);
  }
  
  .user-item.filtered {
    background: rgba(29, 155, 240, 0.15);
    border-color: rgba(29, 155, 240, 0.4);
  }
  
  .user-item.filtered:hover {
    background: rgba(29, 155, 240, 0.2);
    border-color: rgba(29, 155, 240, 0.6);
  }
  
  .user-item:focus {
    outline: 3px solid #1d9bf0;
    outline-offset: 2px;
  }
  
  .user-item:focus:not(:focus-visible) {
    outline: none;
  }
  
  .user-item:focus-visible {
    outline: 3px solid #1d9bf0;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(29, 155, 240, 0.2);
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }
  
  .user-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(29, 155, 240, 0.1);
    border-radius: 50%;
    color: rgba(29, 155, 240, 0.8);
    flex-shrink: 0;
  }
  
  .user-item.filtered .user-icon {
    background: rgba(29, 155, 240, 0.2);
    color: rgba(29, 155, 240, 1);
  }
  
  .user-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    flex: 1;
  }
  
  .user-username {
    font-size: 0.875rem;
    font-weight: 600;
    color: #e7e9ea;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .filter-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .indicator-dot {
    width: 8px;
    height: 8px;
    background: rgba(29, 155, 240, 1);
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(29, 155, 240, 0.6);
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }
  
  /* Responsive - Mobile Overlay Behavior */
  @media (max-width: 768px) {
    .mobile-toggle {
      display: flex;
    }
    
    .mobile-backdrop {
      display: block;
    }
    
    .mobile-close {
      display: flex;
    }
    
    .user-list-sidebar {
      /* Convert to overlay on mobile */
      width: 280px;
      transform: translateX(-100%);
      transition: transform 0.3s ease-in-out;
      /* Adjust height for safe areas on mobile */
      height: calc(100vh - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
      /* Higher z-index for overlay */
      z-index: 60;
    }
    
    .user-list-sidebar.mobile-open {
      transform: translateX(0);
    }
    
    /* Increase touch target sizes on mobile */
    .user-item {
      min-height: 48px;
      padding: 1rem 0.75rem;
    }
    
    .search-input {
      padding: 0.875rem 0.875rem 0.875rem 2.75rem;
      font-size: 1rem;
    }
    
    .search-container {
      position: relative;
    }
  }
  
  /* Very small mobile devices */
  @media (max-width: 480px) {
    .user-list-sidebar {
      width: 100vw;
    }
  }
</style>
