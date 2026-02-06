/**
 * Data models and type definitions for the Crypto Twitter Alpha Stream
 */

// Event Types - matching actor event types directly
export type EventType = 
  | 'post_created' 
  | 'post_updated'
  | 'follow_created' 
  | 'follow_updated'
  | 'user_updated' 
  | 'profile_updated'
  | 'profile_pinned';

// Twitter Event Models
export interface TwitterEvent {
  type: EventType;
  timestamp: string;  // ISO 8601
  primaryId: string;  // Tweet ID or User ID
  user: {
    username: string;
    displayName: string;
    userId: string;
  };
  data: PostData | ProfileData | FollowingData;
}

export interface PostData {
  tweetId: string;
  username: string;
  action: string;
  tweet?: {
    id: string;
    type: string;
    created_at: string;
    body: {
      text: string;
      urls?: Array<{
        name: string;
        url: string;
        tco: string;
      }>;
      mentions?: string[];
    };
    author: {
      handle: string;
      id?: string;
      verified?: boolean;
      profile?: {
        name: string;
        avatar?: string;
        bio?: string;
      };
    };
    metrics?: {
      likes?: number;
      retweets?: number;
      replies?: number;
      views?: number;
    };
    media?: {
      images?: string[];
      videos?: string[];
    };
    subtweet?: any;
  };
}

export interface ProfileData {
  username: string;
  action: string;
  user?: {
    id: string;
    handle: string;
    private?: boolean;
    verified?: boolean;
    jointed_at?: number;
    profile?: {
      name: string;
      location?: string;
      avatar?: string;
      banner?: string;
      pinned?: string[];
      url?: {
        name: string;
        url: string;
        tco: string;
      } | null;
      description?: {
        text: string;
        urls?: any[];
      };
    };
    metrics?: {
      media?: number;
      tweets?: number;
      following?: number;
      followers?: number;
    };
  };
  before?: {
    id: string;
    handle: string;
    private?: boolean;
    verified?: boolean;
    jointed_at?: number;
    profile?: {
      name: string;
      location?: string;
      avatar?: string;
      banner?: string;
      pinned?: string[];
      url?: {
        name: string;
        url: string;
        tco: string;
      } | null;
      description?: {
        text: string;
        urls?: any[];
      };
    };
    metrics?: {
      media?: number;
      tweets?: number;
      following?: number;
      followers?: number;
    };
  };
  pinned?: Array<{
    id: string;
    type: string;
    created_at: string;
    body: {
      text: string;
    };
    author?: {
      handle: string;
      profile?: {
        avatar: string;
        name: string;
      };
    };
    media?: {
      images?: string[];
      videos?: string[];
    };
  }>;
}

export interface FollowingData {
  username: string;
  action: string;
  user?: {
    id: string;
    handle: string;
    private?: boolean;
    verified?: boolean;
    jointed_at?: number;
    profile?: {
      name: string;
      location?: string;
      avatar?: string;
      banner?: string;
      pinned?: string[];
      url?: {
        name: string;
        url: string;
        tco: string;
      } | null;
      description?: {
        text: string;
        urls?: any[];
      };
    };
    metrics?: {
      media?: number;
      tweets?: number;
      following?: number;
      followers?: number;
    };
  };
  following?: {
    id: string;
    handle: string;
    private?: boolean;
    verified?: boolean;
    jointed_at?: number;
    profile?: {
      name: string;
      location?: string;
      avatar?: string;
      banner?: string;
      pinned?: string[];
      url?: {
        name: string;
        url: string;
        tco: string;
      } | null;
      description?: {
        text: string;
        urls?: any[];
      };
    };
    metrics?: {
      media?: number;
      tweets?: number;
      following?: number;
      followers?: number;
    };
  };
  others?: any[];
}

// Raw Event from SSE
export interface RawEvent {
  id: string;
  event: string;
  data: string;  // JSON string
}

// Filter Configuration
export interface FilterConfig {
  users: string[];
  keywords: string[];
  eventTypes: EventType[];
}

// Event Statistics
export interface EventStats {
  total: number;
  delivered: number;
  deduped: number;
  byType: Record<EventType, number>;
  startTime: Date;
  lastEventTime: Date;
}

// Health Status
export interface HealthStatus {
  connection: {
    status: 'connected' | 'disconnected' | 'reconnecting';
    endpoint: string;
    uptime: number;  // seconds
  };
  events: {
    total: number;
    delivered: number;
    deduped: number;
    rate: number;  // events per second
  };
  alerts: {
    telegram: { sent: number; failed: number };
    discord: { sent: number; failed: number };
    webhook: { sent: number; failed: number };
  };
  filters: {
    users: string[];
    keywords: string[];
  };
}

// Type Guards
export function isPostData(data: any): data is PostData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.username === 'string' &&
    typeof data.action === 'string' &&
    typeof data.tweetId === 'string'
  );
}

export function isProfileData(data: any): data is ProfileData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.username === 'string' &&
    typeof data.action === 'string' &&
    (data.user !== undefined || data.pinned !== undefined)
  );
}

export function isFollowingData(data: any): data is FollowingData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.username === 'string' &&
    typeof data.action === 'string' &&
    data.following !== undefined
  );
}

export function isValidEventType(type: any): type is EventType {
  return (
    type === 'post_created' ||
    type === 'post_updated' ||
    type === 'follow_created' ||
    type === 'follow_updated' ||
    type === 'user_updated' ||
    type === 'profile_updated' ||
    type === 'profile_pinned'
  );
}

export function isTwitterEvent(event: any): event is TwitterEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    isValidEventType(event.type) &&
    typeof event.timestamp === 'string' &&
    typeof event.primaryId === 'string' &&
    typeof event.user === 'object' &&
    event.user !== null &&
    typeof event.user.username === 'string' &&
    typeof event.user.displayName === 'string' &&
    typeof event.user.userId === 'string' &&
    (isPostData(event.data) || isProfileData(event.data) || isFollowingData(event.data))
  );
}

export function isRawEvent(event: any): event is RawEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof event.id === 'string' &&
    typeof event.event === 'string' &&
    typeof event.data === 'string'
  );
}
