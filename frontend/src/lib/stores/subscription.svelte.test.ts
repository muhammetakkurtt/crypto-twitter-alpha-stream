import { describe, it, expect, beforeEach } from 'vitest';
import { subscriptionStore } from './subscription.svelte';
import type { RuntimeSubscriptionState, Channel } from '$lib/types';

describe('SubscriptionStore', () => {
  const createMockState = (
    channels: Channel[] = ['all'],
    users: string[] = []
  ): RuntimeSubscriptionState => ({
    channels,
    users,
    mode: channels.length === 0 ? 'idle' : 'active',
    source: 'config',
    updatedAt: new Date().toISOString()
  });

  beforeEach(() => {
    // Reset store to initial state
    subscriptionStore.appliedState = null;
    subscriptionStore.stagedChannels = [];
    subscriptionStore.stagedUsers = [];
    subscriptionStore.isLoading = false;
    subscriptionStore.error = null;
  });

  describe('initialize', () => {
    it('should set both applied and staged state', () => {
      const state = createMockState(['tweets', 'following'], ['elonmusk']);
      
      subscriptionStore.initialize(state);
      
      expect(subscriptionStore.appliedState).toEqual(state);
      expect(subscriptionStore.stagedChannels).toEqual(['tweets', 'following']);
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk']);
      expect(subscriptionStore.error).toBeNull();
    });

    it('should clear any existing error', () => {
      subscriptionStore.error = 'Previous error';
      const state = createMockState();
      
      subscriptionStore.initialize(state);
      
      expect(subscriptionStore.error).toBeNull();
    });

    it('should handle empty channels and users', () => {
      const state = createMockState([], []);
      
      subscriptionStore.initialize(state);
      
      expect(subscriptionStore.stagedChannels).toEqual([]);
      expect(subscriptionStore.stagedUsers).toEqual([]);
    });
  });

  describe('setStagedChannels', () => {
    it('should update only staged channels', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels(['tweets', 'following']);
      
      expect(subscriptionStore.stagedChannels).toEqual(['tweets', 'following']);
      expect(subscriptionStore.appliedState?.channels).toEqual(['all']);
    });

    it('should allow setting empty channels array', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels([]);
      
      expect(subscriptionStore.stagedChannels).toEqual([]);
    });
  });

  describe('setStagedUsers', () => {
    it('should update only staged users', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedUsers(['elonmusk', 'vitalikbuterin']);
      
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk', 'vitalikbuterin']);
      expect(subscriptionStore.appliedState?.users).toEqual([]);
    });

    it('should allow setting empty users array', () => {
      const state = createMockState(['all'], ['elonmusk']);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedUsers([]);
      
      expect(subscriptionStore.stagedUsers).toEqual([]);
    });
  });

  describe('discardChanges', () => {
    it('should revert staged state to applied state', () => {
      const state = createMockState(['all'], ['elonmusk']);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels(['tweets']);
      subscriptionStore.setStagedUsers(['vitalikbuterin']);
      
      subscriptionStore.discardChanges();
      
      expect(subscriptionStore.stagedChannels).toEqual(['all']);
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk']);
    });

    it('should clear any error', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      subscriptionStore.error = 'Some error';
      
      subscriptionStore.discardChanges();
      
      expect(subscriptionStore.error).toBeNull();
    });

    it('should handle null appliedState gracefully', () => {
      subscriptionStore.appliedState = null;
      
      expect(() => subscriptionStore.discardChanges()).not.toThrow();
    });
  });

  describe('applySuccess', () => {
    it('should update applied state and sync staged state', () => {
      const initialState = createMockState(['all'], []);
      subscriptionStore.initialize(initialState);
      
      const newState = createMockState(['tweets', 'following'], ['elonmusk']);
      subscriptionStore.applySuccess(newState);
      
      expect(subscriptionStore.appliedState).toEqual(newState);
      expect(subscriptionStore.stagedChannels).toEqual(['tweets', 'following']);
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk']);
    });

    it('should clear loading state', () => {
      subscriptionStore.isLoading = true;
      const state = createMockState();
      
      subscriptionStore.applySuccess(state);
      
      expect(subscriptionStore.isLoading).toBe(false);
    });

    it('should clear error', () => {
      subscriptionStore.error = 'Previous error';
      const state = createMockState();
      
      subscriptionStore.applySuccess(state);
      
      expect(subscriptionStore.error).toBeNull();
    });
  });

  describe('applyError', () => {
    it('should set error message', () => {
      subscriptionStore.applyError('Update failed');
      
      expect(subscriptionStore.error).toBe('Update failed');
    });

    it('should clear loading state', () => {
      subscriptionStore.isLoading = true;
      
      subscriptionStore.applyError('Update failed');
      
      expect(subscriptionStore.isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      subscriptionStore.setLoading(true);
      
      expect(subscriptionStore.isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      subscriptionStore.isLoading = true;
      
      subscriptionStore.setLoading(false);
      
      expect(subscriptionStore.isLoading).toBe(false);
    });
  });

  describe('hasUnsavedChanges', () => {
    it('should return false when no applied state exists', () => {
      subscriptionStore.appliedState = null;
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(false);
    });

    it('should return false when staged matches applied', () => {
      const state = createMockState(['all'], ['elonmusk']);
      subscriptionStore.initialize(state);
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(false);
    });

    it('should return true when channels differ', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels(['tweets']);
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(true);
    });

    it('should return true when users differ', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedUsers(['elonmusk']);
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(true);
    });

    it('should return true when both channels and users differ', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels(['tweets']);
      subscriptionStore.setStagedUsers(['elonmusk']);
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(true);
    });

    it('should ignore order differences in channels', () => {
      const state = createMockState(['tweets', 'following'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels(['following', 'tweets']);
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(false);
    });

    it('should ignore order differences in users', () => {
      const state = createMockState(['all'], ['elonmusk', 'vitalikbuterin']);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedUsers(['vitalikbuterin', 'elonmusk']);
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(false);
    });

    it('should return false after discarding changes', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels(['tweets']);
      expect(subscriptionStore.hasUnsavedChanges).toBe(true);
      
      subscriptionStore.discardChanges();
      expect(subscriptionStore.hasUnsavedChanges).toBe(false);
    });

    it('should return false after successful apply', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.setStagedChannels(['tweets']);
      expect(subscriptionStore.hasUnsavedChanges).toBe(true);
      
      const newState = createMockState(['tweets'], []);
      subscriptionStore.applySuccess(newState);
      expect(subscriptionStore.hasUnsavedChanges).toBe(false);
    });
  });

  describe('copyFromLocalSelected', () => {
    it('should normalize and update staged users', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected(['ElonMusk', 'VitalikButerin', 'SatoshiNakamoto']);
      
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk', 'satoshinakamoto', 'vitalikbuterin']);
    });

    it('should handle empty array', () => {
      const state = createMockState(['all'], ['existinguser']);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected([]);
      
      expect(subscriptionStore.stagedUsers).toEqual([]);
    });

    it('should remove duplicate users', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected(['elonmusk', 'ElonMusk', 'ELONMUSK', 'vitalikbuterin']);
      
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk', 'vitalikbuterin']);
    });

    it('should trim whitespace from users', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected(['  elonmusk  ', 'vitalikbuterin   ', '   satoshinakamoto']);
      
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk', 'satoshinakamoto', 'vitalikbuterin']);
    });

    it('should filter out empty strings', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected(['elonmusk', '', '   ', 'vitalikbuterin']);
      
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk', 'vitalikbuterin']);
    });

    it('should sort users alphabetically', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected(['zebra', 'apple', 'mango', 'banana']);
      
      expect(subscriptionStore.stagedUsers).toEqual(['apple', 'banana', 'mango', 'zebra']);
    });

    it('should mark as having unsaved changes after copy', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected(['elonmusk', 'vitalikbuterin']);
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(true);
    });

    it('should not trigger network call (only updates draft)', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.copyFromLocalSelected(['elonmusk']);
      
      // Applied state should remain unchanged
      expect(subscriptionStore.appliedState?.users).toEqual([]);
      // Only staged state should be updated
      expect(subscriptionStore.stagedUsers).toEqual(['elonmusk']);
    });
  });

  describe('clearUpstreamUsers', () => {
    it('should clear staged users', () => {
      const state = createMockState(['all'], ['elonmusk', 'vitalikbuterin']);
      subscriptionStore.initialize(state);
      
      subscriptionStore.clearUpstreamUsers();
      
      expect(subscriptionStore.stagedUsers).toEqual([]);
    });

    it('should mark as having unsaved changes if applied state has users', () => {
      const state = createMockState(['all'], ['elonmusk', 'vitalikbuterin']);
      subscriptionStore.initialize(state);
      
      subscriptionStore.clearUpstreamUsers();
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(true);
    });

    it('should not mark as having unsaved changes if applied state has no users', () => {
      const state = createMockState(['all'], []);
      subscriptionStore.initialize(state);
      
      subscriptionStore.clearUpstreamUsers();
      
      expect(subscriptionStore.hasUnsavedChanges).toBe(false);
    });

    it('should not affect applied state', () => {
      const state = createMockState(['all'], ['elonmusk']);
      subscriptionStore.initialize(state);
      
      subscriptionStore.clearUpstreamUsers();
      
      expect(subscriptionStore.appliedState?.users).toEqual(['elonmusk']);
    });
  });
});
