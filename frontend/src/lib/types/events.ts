/**
 * Event type definitions for the Svelte 5 Dashboard
 * Based on the backend TwitterEvent model
 */

export type EventType = 
  | 'post_created' 
  | 'post_updated'
  | 'follow_created' 
  | 'follow_updated'
  | 'user_updated' 
  | 'profile_updated'
  | 'profile_pinned';

export interface TwitterEvent {
  type: EventType;
  timestamp: string;
  primaryId: string;
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

/**
 * Runtime subscription types
 */

export type Channel = 'all' | 'tweets' | 'following' | 'profile';

export type RuntimeSubscriptionMode = 'active' | 'idle';

export type RuntimeSubscriptionSource = 'config' | 'runtime';

export interface RuntimeSubscriptionState {
  channels: Channel[];
  users: string[];
  mode: RuntimeSubscriptionMode;
  source: RuntimeSubscriptionSource;
  updatedAt: string;
}

export interface UpdateRuntimeSubscriptionPayload {
  channels: Channel[];
  users: string[];
}
