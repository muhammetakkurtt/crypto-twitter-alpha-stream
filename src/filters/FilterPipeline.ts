/**
 * Filter pipeline for applying multiple filters in sequence
 */

import { TwitterEvent } from '../models/types';
import { EventFilter } from './EventFilter';

/**
 * Manages a chain of filters and applies them in sequence
 * All filters must pass for an event to be accepted
 */
export class FilterPipeline {
  private filters: Map<string, EventFilter>;

  constructor() {
    this.filters = new Map();
  }

  /**
   * Add a filter to the pipeline
   * If a filter with the same ID exists, it will be replaced
   */
  addFilter(filter: EventFilter): void {
    this.filters.set(filter.id, filter);
  }

  /**
   * Remove a filter from the pipeline by ID
   */
  removeFilter(filterId: string): void {
    this.filters.delete(filterId);
  }

  /**
   * Apply all filters to an event
   * Returns true if the event passes all filters (AND logic)
   * Returns true if no filters are configured (allow all)
   */
  apply(event: TwitterEvent): boolean {
    // No filters means allow all
    if (this.filters.size === 0) {
      return true;
    }

    // All filters must pass
    for (const filter of this.filters.values()) {
      if (!filter.apply(event)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the number of filters in the pipeline
   */
  size(): number {
    return this.filters.size;
  }

  /**
   * Clear all filters from the pipeline
   */
  clear(): void {
    this.filters.clear();
  }

  /**
   * Get all filter IDs
   */
  getFilterIds(): string[] {
    return Array.from(this.filters.keys());
  }

  /**
   * Get filter configuration (users and keywords)
   */
  getConfig(): { users: string[]; keywords: string[] } {
    const users: string[] = [];
    const keywords: string[] = [];

    for (const filter of this.filters.values()) {
      if (filter.type === 'user' && 'usernames' in filter) {
        users.push(...(filter as any).usernames);
      } else if (filter.type === 'keyword' && 'keywords' in filter) {
        keywords.push(...(filter as any).keywords);
      }
    }

    return { users, keywords };
  }
}
