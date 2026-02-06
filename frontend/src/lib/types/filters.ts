/**
 * Filter type definitions for the Svelte 5 Dashboard
 */

import type { EventType } from './events';

export interface FilterConfig {
  keywords: string[];
  eventTypes: EventType[];
  users: string[];
}

export interface FilterState {
  keywords: string[];
  eventTypes: EventType[];
  users: string[];
  hasActiveFilters: boolean;
}

export type FilterAction = 
  | { type: 'SET_KEYWORDS'; payload: string[] }
  | { type: 'ADD_KEYWORD'; payload: string }
  | { type: 'REMOVE_KEYWORD'; payload: string }
  | { type: 'TOGGLE_EVENT_TYPE'; payload: EventType }
  | { type: 'SET_EVENT_TYPES'; payload: EventType[] }
  | { type: 'TOGGLE_USER'; payload: string }
  | { type: 'ADD_USER'; payload: string }
  | { type: 'REMOVE_USER'; payload: string }
  | { type: 'CLEAR_ALL' };
