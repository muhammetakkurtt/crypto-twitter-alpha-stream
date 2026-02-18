import type { Channel, RuntimeSubscriptionState } from '$lib/types';

/**
 * Subscription store managing staged and applied subscription state
 * Implements staged-apply pattern for runtime subscription updates
 */
class SubscriptionStore {
  // Applied state (currently active on server)
  appliedState = $state<RuntimeSubscriptionState | null>(null);
  
  // Staged state (draft changes not yet applied)
  stagedChannels = $state<Channel[]>([]);
  stagedUsers = $state<string[]>([]);
  
  // UI state
  isLoading = $state<boolean>(false);
  error = $state<string | null>(null);
  hasUnsavedChanges = $derived(this.computeHasUnsavedChanges());

  /**
   * Initialize store with current server state
   */
  initialize(state: RuntimeSubscriptionState): void {
    this.appliedState = state;
    this.stagedChannels = [...state.channels];
    this.stagedUsers = [...state.users];
    this.error = null;
  }

  /**
   * Update staged channels
   */
  setStagedChannels(channels: Channel[]): void {
    this.stagedChannels = channels;
  }

  /**
   * Update staged users
   */
  setStagedUsers(users: string[]): void {
    this.stagedUsers = users;
  }

  /**
   * Discard staged changes and revert to applied state
   */
  discardChanges(): void {
    if (this.appliedState) {
      this.stagedChannels = [...this.appliedState.channels];
      this.stagedUsers = [...this.appliedState.users];
    }
    this.error = null;
  }

  /**
   * Mark apply as successful and update applied state
   */
  applySuccess(newState: RuntimeSubscriptionState): void {
    this.appliedState = newState;
    this.stagedChannels = [...newState.channels];
    this.stagedUsers = [...newState.users];
    this.isLoading = false;
    this.error = null;
  }

  /**
   * Mark apply as failed
   */
  applyError(errorMessage: string): void {
    this.error = errorMessage;
    this.isLoading = false;
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  /**
   * Copy selected users from local filter to upstream subscription draft
   * Normalizes users (trim, lowercase, unique, sort) and updates stagedUsers
   * Does not trigger network call - only updates draft state
   */
  copyFromLocalSelected(users: string[]): void {
    const normalized = this.normalizeUsers(users);
    this.stagedUsers = normalized;
  }

  /**
   * Clear upstream users from staged state
   * Marks as having unsaved changes if applied state has users
   */
  clearUpstreamUsers(): void {
    this.stagedUsers = [];
  }

  /**
   * Normalize user array
   * - Trim whitespace
   * - Convert to lowercase
   * - Remove empty strings
   * - Remove duplicates
   * - Sort for consistency
   */
  private normalizeUsers(users: string[]): string[] {
    const normalized = users
      .map(u => u.trim().toLowerCase())
      .filter(u => u.length > 0);

    return [...new Set(normalized)].sort();
  }

  /**
   * Compute if there are unsaved changes
   */
  private computeHasUnsavedChanges(): boolean {
    if (!this.appliedState) return false;

    const channelsChanged = 
      JSON.stringify([...this.stagedChannels].sort()) !== 
      JSON.stringify([...this.appliedState.channels].sort());

    const usersChanged = 
      JSON.stringify([...this.stagedUsers].sort()) !== 
      JSON.stringify([...this.appliedState.users].sort());

    return channelsChanged || usersChanged;
  }
}

export const subscriptionStore = new SubscriptionStore();
