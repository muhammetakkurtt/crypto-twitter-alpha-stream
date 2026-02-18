<script lang="ts">
  import { subscriptionStore } from '$lib/stores/subscription.svelte';
  import { socketStore } from '$lib/stores/socket.svelte';
  import { toastStore } from '$lib/stores/toast.svelte';
  import { filtersStore } from '$lib/stores/filters.svelte';
  import type { Channel } from '$lib/types';

  const availableChannels: Array<{ value: Channel; label: string }> = [
    { value: 'all', label: 'All Events' },
    { value: 'tweets', label: 'Tweets' },
    { value: 'following', label: 'Following' },
    { value: 'profile', label: 'Profile' }
  ];

  // Derived state for selected users count
  const selectedUsersCount = $derived(filtersStore.users.length);
  
  // Check if "all" channel is selected
  const isAllChannelSelected = $derived(subscriptionStore.stagedChannels.includes('all'));

  let usersInput = $state('');

  // Load initial state on mount
  $effect(() => {
    if (socketStore.connectionStatus === 'connected' && !subscriptionStore.appliedState) {
      loadSubscriptionState();
    }
  });

  async function loadSubscriptionState() {
    try {
      const state = await socketStore.getRuntimeSubscription();
      subscriptionStore.initialize(state);
      // Set usersInput when state is loaded
      usersInput = state.users.length > 0 ? state.users.join(', ') : '';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load subscription';
      toastStore.error(`Failed to load subscription: ${errorMsg}`);
    }
  }

  function toggleChannel(channel: Channel) {
    const current = subscriptionStore.stagedChannels;
    
    if (channel === 'all') {
      // If toggling "all", either select only "all" or deselect it
      if (current.includes('all')) {
        subscriptionStore.setStagedChannels([]);
      } else {
        subscriptionStore.setStagedChannels(['all']);
      }
    } else {
      // If selecting a specific channel, remove "all" first
      const withoutAll = current.filter(c => c !== 'all');
      
      if (withoutAll.includes(channel)) {
        subscriptionStore.setStagedChannels(withoutAll.filter(c => c !== channel));
      } else {
        subscriptionStore.setStagedChannels([...withoutAll, channel]);
      }
    }
  }

  function isChannelChecked(channel: Channel): boolean {
    return subscriptionStore.stagedChannels.includes(channel);
  }
  
  function isChannelDisabled(channel: Channel): boolean {
    // Disable specific channels when "all" is selected
    return channel !== 'all' && isAllChannelSelected;
  }

  function updateUsers() {
    const users = usersInput
      .split(',')
      .map(u => u.trim())
      .filter(u => u.length > 0);
    subscriptionStore.setStagedUsers(users);
  }

  async function applyChanges() {
    subscriptionStore.setLoading(true);
    
    try {
      const newState = await socketStore.setRuntimeSubscription({
        channels: subscriptionStore.stagedChannels,
        users: subscriptionStore.stagedUsers
      });
      
      subscriptionStore.applySuccess(newState);
      toastStore.success('Subscription updated successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to update subscription';
      subscriptionStore.applyError(errorMsg);
      toastStore.error(`Failed to update subscription: ${errorMsg}`);
    }
  }

  function discardChanges() {
    subscriptionStore.discardChanges();
    // Set usersInput when user discards changes
    if (subscriptionStore.appliedState) {
      usersInput = subscriptionStore.appliedState.users.length > 0 
        ? subscriptionStore.appliedState.users.join(', ') 
        : '';
    }
    toastStore.info('Changes discarded');
  }

  function useSelectedUsers() {
    subscriptionStore.copyFromLocalSelected(filtersStore.users);
    // Update usersInput to reflect the copied users immediately
    usersInput = subscriptionStore.stagedUsers.join(', ');
    toastStore.success(`Copied ${selectedUsersCount} users from left sidebar to upstream draft`);
  }

  function clearUpstreamUsers() {
    subscriptionStore.clearUpstreamUsers();
    // Clear usersInput to reflect the cleared state immediately
    usersInput = '';
    toastStore.success('Cleared upstream users');
  }

  function formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  }
</script>

<div class="subscription-panel" role="region" aria-label="Runtime subscription control">
  <div class="panel-content">
    <!-- Filter Scope Distinction Banner -->
    <div class="scope-distinction-banner" role="alert">
      <div class="scope-section local-scope">
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
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        <div class="scope-content">
          <strong>Local Filters (Left Sidebar):</strong>
          <span>Only affect dashboard view (this browser)</span>
        </div>
      </div>
      <div class="scope-divider"></div>
      <div class="scope-section global-scope">
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
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <div class="scope-content">
          <strong>This Panel:</strong>
          <span>Affects CLI + Dashboard + Alerts + costs</span>
        </div>
      </div>
    </div>

    <div class="warning-banner" role="alert">
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
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>Global Effect: Changes affect CLI, Alerts, and Dashboard outputs</span>
    </div>

    {#if subscriptionStore.appliedState}
      <div class="current-state">
        <h3 class="state-title">Current State</h3>
        <div class="state-info">
          <div class="state-row">
            <span class="state-label">Mode:</span>
            <span class="state-value state-mode" class:idle={subscriptionStore.appliedState.mode === 'idle'}>
              {subscriptionStore.appliedState.mode}
            </span>
          </div>
          <div class="state-row">
            <span class="state-label">Source:</span>
            <span class="state-value state-source" class:runtime={subscriptionStore.appliedState.source === 'runtime'}>
              {subscriptionStore.appliedState.source}
            </span>
          </div>
          <div class="state-row">
            <span class="state-label">Updated:</span>
            <span class="state-value">{formatDate(subscriptionStore.appliedState.updatedAt)}</span>
          </div>
        </div>
      </div>
    {/if}

    <div class="scrollable-content">
      <form class="subscription-form" onsubmit={(e) => { e.preventDefault(); applyChanges(); }}>
        <!-- Channels Section -->
        <fieldset class="filter-section">
          <legend class="filter-label">Channels</legend>
          <div class="checkbox-group">
            {#each availableChannels as { value, label }}
              <label class="checkbox-label" class:disabled={isChannelDisabled(value)}>
                <input
                  type="checkbox"
                  class="checkbox-input"
                  checked={isChannelChecked(value)}
                  onchange={() => toggleChannel(value)}
                  disabled={subscriptionStore.isLoading || isChannelDisabled(value)}
                  aria-label={`Subscribe to ${label}`}
                />
                <span class="checkbox-text">{label}</span>
                {#if value === 'all'}
                  <span class="channel-hint">(disables other channels)</span>
                {/if}
              </label>
            {/each}
          </div>
        </fieldset>

        <!-- Users Section -->
        <div class="filter-section">
          <label for="users-input" class="filter-label">
            Upstream Users
            <span class="filter-hint">(comma-separated)</span>
          </label>
          
          <!-- Copy Buttons -->
          <div class="copy-actions">
            <button
              type="button"
              class="copy-button"
              onclick={useSelectedUsers}
              disabled={selectedUsersCount === 0 || subscriptionStore.isLoading}
              aria-label={`Copy ${selectedUsersCount} selected users from local filter`}
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
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Use selected users ({selectedUsersCount})
            </button>
            
            <button
              type="button"
              class="clear-button"
              onclick={clearUpstreamUsers}
              disabled={subscriptionStore.stagedUsers.length === 0 || subscriptionStore.isLoading}
              aria-label="Clear upstream users"
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
              Clear upstream users
            </button>
          </div>
          
          {#if selectedUsersCount === 0}
            <p class="help-text copy-help hint-message">
              💡 Tip: Select users from the left sidebar, then click "Use selected users" to copy them here
            </p>
          {:else}
            <p class="help-text copy-help">
              Copy your local filter selections to the global upstream subscription, or manually enter users below
            </p>
          {/if}
          
          <textarea
            id="users-input"
            class="users-textarea"
            placeholder="elonmusk, vitalikbuterin, ..."
            bind:value={usersInput}
            oninput={updateUsers}
            disabled={subscriptionStore.isLoading}
            aria-describedby="users-help"
          ></textarea>
          
          <!-- User Tags Preview -->
          {#if subscriptionStore.stagedUsers.length > 0}
            <div class="user-tags">
              {#each subscriptionStore.stagedUsers as user}
                <span class="user-tag">{user}</span>
              {/each}
            </div>
          {/if}
          
          <p id="users-help" class="help-text">
            Leave empty to monitor all 1000+ tracked accounts
          </p>
        </div>

        {#if subscriptionStore.error}
          <div class="error-message" role="alert">
            {subscriptionStore.error}
          </div>
        {/if}
      </form>
    </div>
  </div>

  <!-- Sticky Actions Section -->
  <div class="sticky-actions">
    <button
      type="button"
      class="apply-button"
      onclick={applyChanges}
      disabled={!subscriptionStore.hasUnsavedChanges || subscriptionStore.isLoading}
      aria-label="Apply subscription changes"
    >
      {#if subscriptionStore.isLoading}
        <svg
          class="spinner"
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
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
        Applying...
      {:else}
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
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Apply Changes
      {/if}
    </button>
    
    <button
      type="button"
      class="discard-button"
      onclick={discardChanges}
      disabled={!subscriptionStore.hasUnsavedChanges || subscriptionStore.isLoading}
      aria-label="Discard subscription changes"
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
      Discard
    </button>
  </div>
</div>

<style>
  .subscription-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    border-radius: var(--radius-lg);
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid #334155;
    backdrop-filter: blur(12px);
    transition: all 0.3s ease;
    position: relative;
    height: 100%;
  }

  .subscription-panel:hover {
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  /* Panel Content Wrapper */
  .panel-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem;
    padding-bottom: 0;
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
  }

  .panel-content::-webkit-scrollbar {
    width: 6px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: rgba(22, 24, 28, 0.3);
    border-radius: 3px;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.4);
    border-radius: 3px;
  }

  .panel-content::-webkit-scrollbar-thumb:hover {
    background: rgba(148, 163, 184, 0.6);
  }

  /* Scrollable Content Area */
  .scrollable-content {
    flex: 1;
    overflow-y: visible;
    overflow-x: hidden;
  }

  /* Warning Banner */
  .warning-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(251, 191, 36, 0.15);
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: var(--radius-md);
    color: #fbbf24;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .warning-banner svg {
    flex-shrink: 0;
  }

  /* Scope Distinction Banner */
  .scope-distinction-banner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid #334155;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
  }

  .scope-section {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .scope-section svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .local-scope {
    color: #60a5fa;
  }

  .local-scope svg {
    color: #60a5fa;
  }

  .global-scope {
    color: #a855f7;
  }

  .global-scope svg {
    color: #a855f7;
  }

  .scope-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .scope-content strong {
    font-weight: 600;
  }

  .scope-content span {
    color: #cbd5e1;
    font-size: 0.8125rem;
  }

  .scope-divider {
    height: 1px;
    background: #334155;
    margin: 0.25rem 0;
  }

  /* Current State Display */
  .current-state {
    padding: 1rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid #334155;
    border-radius: var(--radius-md);
  }

  .state-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .state-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .state-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .state-label {
    font-size: 0.875rem;
    color: #94a3b8;
    min-width: 70px;
  }

  .state-value {
    font-size: 0.875rem;
    color: #f1f5f9;
    font-weight: 500;
  }

  .state-mode {
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-sm);
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .state-mode.idle {
    background: rgba(148, 163, 184, 0.2);
    border-color: rgba(148, 163, 184, 0.3);
    color: #94a3b8;
  }

  .state-source {
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-sm);
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .state-source.runtime {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.3);
    color: #a855f7;
  }

  /* Form Layout */
  .subscription-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Filter Section */
  .filter-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: none;
    padding: 0;
    margin: 0;
  }

  fieldset.filter-section {
    min-inline-size: auto;
    margin-block-start: 0;
    margin-block-end: 0;
    margin-inline-start: 0;
    margin-inline-end: 0;
    padding-block-start: 0;
    padding-block-end: 0;
    padding-inline-start: 0;
    padding-inline-end: 0;
  }

  .filter-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-hint {
    font-size: 0.75rem;
    font-weight: 400;
    color: #94a3b8;
  }

  /* Checkbox Group */
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    margin: 0;
  }

  .checkbox-label:hover:not(.disabled) {
    background: rgba(59, 130, 246, 0.1);
  }

  .checkbox-label.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox-input {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #334155;
    background: rgba(30, 41, 59, 0.6);
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    position: relative;
  }

  .checkbox-input:checked {
    background: #3b82f6;
    border-color: #3b82f6;
  }

  .checkbox-input:checked::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 5px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .checkbox-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox-input:focus {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
  }

  .checkbox-text {
    font-size: 0.875rem;
    color: #f1f5f9;
    user-select: none;
  }

  .channel-hint {
    margin-left: auto;
    font-size: 0.75rem;
    color: #94a3b8;
    font-style: italic;
  }

  /* Users Textarea */
  .users-textarea {
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #334155;
    color: #f1f5f9;
    font-size: 0.875rem;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    resize: vertical;
    transition: all 0.2s ease;
    outline: none;
  }

  .users-textarea::placeholder {
    color: #94a3b8;
  }

  .users-textarea:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .users-textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .users-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* User Tags Preview */
  .user-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .user-tag {
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-sm);
    background: rgba(168, 85, 247, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #a855f7;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .help-text {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
    padding: 0.25rem 0.5rem;
  }

  .copy-help {
    margin-top: 0;
    margin-bottom: 0.5rem;
    padding: 0.25rem 0;
  }

  .hint-message {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.75rem;
    color: #60a5fa;
  }

  /* Copy Actions */
  .copy-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .copy-button,
  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: var(--radius-md);
    border: none;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
  }

  .copy-button {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #60a5fa;
  }

  .copy-button:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.25);
    border-color: #3b82f6;
    transform: translateY(-1px);
  }

  .copy-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .copy-button:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .clear-button {
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.3);
    color: #94a3b8;
  }

  .clear-button:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.2);
    border-color: #94a3b8;
    transform: translateY(-1px);
  }

  .clear-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .clear-button:focus {
    outline: 2px solid #94a3b8;
    outline-offset: 2px;
  }

  .copy-button:disabled,
  .clear-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  /* Error Message */
  .error-message {
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: var(--radius-md);
    color: #ef4444;
    font-size: 0.875rem;
    font-weight: 500;
  }

  /* Sticky Actions */
  .sticky-actions {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #334155;
    background: rgba(30, 41, 59, 0.98);
    backdrop-filter: blur(8px);
    position: sticky;
    bottom: 0;
    z-index: 10;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }

  .apply-button,
  .discard-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: var(--radius-md);
    border: none;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
  }

  .apply-button {
    background: #3b82f6;
    color: white;
  }

  .apply-button:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .apply-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .apply-button:focus {
    outline: 3px solid #3b82f6;
    outline-offset: 2px;
  }

  .discard-button {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .discard-button:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    transform: translateY(-1px);
  }

  .discard-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .discard-button:focus {
    outline: 3px solid #ef4444;
    outline-offset: 2px;
  }

  .apply-button:disabled,
  .discard-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Spinner Animation */
  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .panel-content {
      padding: 1rem;
      padding-bottom: 0;
    }

    .warning-banner {
      font-size: 0.75rem;
      padding: 0.625rem 0.875rem;
    }

    .scope-distinction-banner {
      font-size: 0.8125rem;
      padding: 0.875rem;
    }

    .copy-actions {
      flex-direction: column;
    }

    .copy-button,
    .clear-button {
      width: 100%;
    }

    .sticky-actions {
      flex-direction: column;
      padding: 1rem;
    }

    .apply-button,
    .discard-button {
      width: 100%;
    }
  }
</style>
