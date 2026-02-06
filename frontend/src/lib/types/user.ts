/**
 * User type definitions for the Svelte 5 Dashboard
 */

export interface User {
  id: string;
  handle: string;
  username: string;
  displayName?: string;
  jointed_at?: string;
  profile?: UserProfile;
  metrics?: UserMetrics;
}

export interface UserProfile {
  name: string;
  location?: string;
  avatar?: string;
  banner?: string;
  pinned?: string[];
  url?: {
    name: string;
    url: string;
    tco: string;
  };
  description?: {
    text: string;
    urls?: any[];
  };
  bio?: string;
}

export interface UserMetrics {
  media?: number;
  tweets?: number;
  following?: number;
  followers?: number;
}

export interface ActiveUser {
  username: string;
  displayName: string;
  eventCount: number;
  lastSeen: string;
}
