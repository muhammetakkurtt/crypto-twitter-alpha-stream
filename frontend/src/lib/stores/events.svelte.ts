import type { TwitterEvent } from '$lib/types';
import { filtersStore } from './filters.svelte';

class EventStore {
  events = $state<TwitterEvent[]>([]);
  eventMap = $state(new Map<string, TwitterEvent>());
  
  filteredEvents = $derived.by(() => {
    return this.events.filter(event => filtersStore.shouldDisplayEvent(event));
  });
  
  addEvent(event: TwitterEvent) {
    if (event.primaryId && this.eventMap.has(event.primaryId)) {
      this.updateEvent(event);
    } else {
      this.events = [event, ...this.events].slice(0, 100);
      if (event.primaryId) {
        this.eventMap.set(event.primaryId, event);
      }
    }
  }
  
  updateEvent(event: TwitterEvent) {
    const index = this.events.findIndex(e => e.primaryId === event.primaryId);
    if (index !== -1) {
      this.events[index] = event;
      if (event.primaryId) {
        this.eventMap.set(event.primaryId, event);
      }
    }
  }
  
  clear() {
    this.events = [];
    this.eventMap.clear();
  }
}

export const eventsStore = new EventStore();
