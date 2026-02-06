/**
 * Filter pipeline for Twitter events
 */

import { TwitterEvent, EventType, PostData, ProfileData, FollowingData } from '../models/types';

/**
 * Base interface for event filters
 */
export interface EventFilter {
  id: string;
  type: 'user' | 'keyword' | 'eventType';
  apply(event: TwitterEvent): boolean;
}

/**
 * Filters events by username
 * Empty usernames list allows all events
 */
export class UserFilter implements EventFilter {
  readonly id: string;
  readonly type = 'user' as const;
  readonly usernames: string[];

  constructor(usernames: string[], id?: string) {
    this.id = id || 'user-filter';
    this.usernames = usernames;
  }

  apply(event: TwitterEvent): boolean {
    // Empty filter allows all
    if (this.usernames.length === 0) {
      return true;
    }
    
    // Check if event username is in the filter list
    return this.usernames.includes(event.user.username);
  }
}

/**
 * Filters events by keywords in text content
 * Empty keywords list allows all events
 * Matching is case-insensitive by default
 */
export class KeywordFilter implements EventFilter {
  readonly id: string;
  readonly type = 'keyword' as const;
  readonly keywords: string[];
  readonly caseSensitive: boolean;

  constructor(keywords: string[], caseSensitive: boolean = false, id?: string) {
    this.id = id || 'keyword-filter';
    this.keywords = keywords;
    this.caseSensitive = caseSensitive;
  }

  apply(event: TwitterEvent): boolean {
    // Empty filter allows all
    if (this.keywords.length === 0) {
      return true;
    }

    // Extract searchable text from event
    const searchText = this.extractSearchableText(event);
    
    // Check if any keyword matches
    return this.keywords.some(keyword => {
      if (this.caseSensitive) {
        return searchText.includes(keyword);
      } else {
        return searchText.toLowerCase().includes(keyword.toLowerCase());
      }
    });
  }

  private extractSearchableText(event: TwitterEvent): string {
    const parts: string[] = [];
    
    // Add user info
    parts.push(event.user.username);
    parts.push(event.user.displayName);
    
    // Add event-specific data based on actor format
    const data = event.data;
    
    if ('tweet' in data && data.tweet) {
      // PostData - extract text from tweet.body.text
      const postData = data as PostData;
      if (postData.tweet?.body?.text) {
        parts.push(postData.tweet.body.text);
      }
    } else if ('user' in data && data.user) {
      // ProfileData or FollowingData
      const profileData = data as ProfileData;
      if (profileData.user?.profile?.name) {
        parts.push(profileData.user.profile.name);
      }
      if (profileData.user?.profile?.description?.text) {
        parts.push(profileData.user.profile.description.text);
      }
    }
    
    if ('following' in data && data.following) {
      // FollowingData - extract following user info
      const followingData = data as FollowingData;
      if (followingData.following?.handle) {
        parts.push(followingData.following.handle);
      }
      if (followingData.following?.profile?.name) {
        parts.push(followingData.following.profile.name);
      }
    }
    
    return parts.join(' ');
  }
}

/**
 * Filters events by event type
 * Empty allowedTypes list allows all events
 */
export class EventTypeFilter implements EventFilter {
  readonly id: string;
  readonly type = 'eventType' as const;
  readonly allowedTypes: EventType[];

  constructor(allowedTypes: EventType[], id?: string) {
    this.id = id || 'eventtype-filter';
    this.allowedTypes = allowedTypes;
  }

  apply(event: TwitterEvent): boolean {
    // Empty filter allows all
    if (this.allowedTypes.length === 0) {
      return true;
    }
    
    // Check if event type is in the allowed list
    return this.allowedTypes.includes(event.type);
  }
}
