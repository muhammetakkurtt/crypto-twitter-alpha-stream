import type { TwitterEvent, EventType, PostData, ProfileData, FollowingData } from '$lib/types';
import { searchStore } from './search.svelte';

const STORAGE_KEY = 'crypto-twitter-filters';

interface FilterState {
  keywords: string[];
  eventTypes: EventType[];
  users: string[];
}

class FilterStore {
  keywords = $state<string[]>([]);
  eventTypes = $state<EventType[]>([
    'post_created',
    'post_updated',
    'profile_updated',
    'profile_pinned',
    'follow_created',
    'follow_updated',
    'user_updated'
  ]);
  users = $state<string[]>([]);
  
  hasActiveFilters = $derived.by(() => {
    const allEventTypes: EventType[] = [
      'post_created',
      'post_updated',
      'profile_updated',
      'profile_pinned',
      'follow_created',
      'follow_updated',
      'user_updated'
    ];
    return (
      this.keywords.length > 0 ||
      this.users.length > 0 ||
      this.eventTypes.length < allEventTypes.length
    );
  });
  
  constructor() {
    this.loadFromStorage();
  }
  
  toggleUser(username: string) {
    const index = this.users.indexOf(username);
    if (index === -1) {
      this.users = [...this.users, username];
    } else {
      this.users = this.users.filter((_, i) => i !== index);
    }
    this.saveToStorage();
  }
  
  setKeywords(keywords: string[]) {
    this.keywords = keywords;
    this.saveToStorage();
  }
  
  toggleEventType(eventType: EventType) {
    const index = this.eventTypes.indexOf(eventType);
    if (index === -1) {
      this.eventTypes = [...this.eventTypes, eventType];
    } else {
      this.eventTypes = this.eventTypes.filter((_, i) => i !== index);
    }
    this.saveToStorage();
  }
  
  shouldDisplayEvent(event: TwitterEvent): boolean {
    if (!this.eventTypes.includes(event.type)) {
      return false;
    }
    
    const searchQuery = searchStore.query.trim().toLowerCase();
    if (searchQuery) {
      const text = this.getEventText(event).toLowerCase();
      if (!text.includes(searchQuery)) {
        return false;
      }
    }
    
    if (this.keywords.length > 0) {
      const text = this.getEventText(event).toLowerCase();
      const hasKeyword = this.keywords.some(k => 
        text.includes(k.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }
    
    if (this.users.length > 0) {
      const username = event.user.username.toLowerCase();
      if (!this.users.some(u => u.toLowerCase() === username)) {
        return false;
      }
    }
    
    return true;
  }
  
  clearAll() {
    this.keywords = [];
    this.users = [];
    this.eventTypes = [
      'post_created',
      'post_updated',
      'profile_updated',
      'profile_pinned',
      'follow_created',
      'follow_updated',
      'user_updated'
    ];
    this.saveToStorage();
  }
  
  private getEventText(event: TwitterEvent): string {
    const parts: string[] = [];
    
    parts.push(event.user.username);
    parts.push(event.user.displayName);
    
    if (event.type === 'post_created' || event.type === 'post_updated') {
      const data = event.data as PostData;
      if (data.tweet?.body?.text) {
        parts.push(data.tweet.body.text);
      }
      if (data.tweet?.author?.profile?.name) {
        parts.push(data.tweet.author.profile.name);
      }
    } else if (event.type === 'profile_updated' || event.type === 'profile_pinned' || event.type === 'user_updated') {
      const data = event.data as ProfileData;
      if (data.user?.profile?.name) {
        parts.push(data.user.profile.name);
      }
      if (data.user?.profile?.description?.text) {
        parts.push(data.user.profile.description.text);
      }
    } else if (event.type === 'follow_created' || event.type === 'follow_updated') {
      const data = event.data as FollowingData;
      if (data.user?.profile?.name) {
        parts.push(data.user.profile.name);
      }
      if (data.following?.profile?.name) {
        parts.push(data.following.profile.name);
      }
      if (data.following?.handle) {
        parts.push(data.following.handle);
      }
    }
    
    return parts.join(' ');
  }
  
  private saveToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const state: FilterState = {
        keywords: this.keywords,
        eventTypes: this.eventTypes,
        users: this.users
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }
  
  private loadFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const state: FilterState = JSON.parse(stored);
          this.keywords = state.keywords || [];
          this.eventTypes = state.eventTypes || [
            'post_created',
            'post_updated',
            'profile_updated',
            'profile_pinned',
            'follow_created',
            'follow_updated',
            'user_updated'
          ];
          this.users = state.users || [];
        } catch (e) {
          console.error('Failed to load filters from storage:', e);
        }
      }
    }
  }
}

export const filtersStore = new FilterStore();
