/**
 * AlertChannel - Base interface and implementations for alert channels
 * 
 * Supports Telegram, Discord, and generic webhook integrations with rate limiting.
 */

import { TwitterEvent, PostData, ProfileData, FollowingData } from '../models/types';
import { RateLimiter } from './RateLimiter';

export interface AlertMessage {
  eventType: string;
  username: string;
  text: string;
  timestamp: string;
  media?: {
    images?: string[];
    videos?: string[];
  };
  tweetUrl?: string;
  userAvatar?: string;
}

export interface AlertChannel {
  name: string;
  enabled: boolean;
  send(message: AlertMessage): Promise<void>;
  rateLimit: RateLimiter;
}

/**
 * Format a Twitter event into an alert message with media support
 */
export function formatAlertMessage(event: TwitterEvent): AlertMessage {
  let text = '';
  let media: { images?: string[]; videos?: string[] } | undefined;
  let tweetUrl: string | undefined;
  let userAvatar: string | undefined;
  
  try {
    switch (event.type) {
      case 'post_created':
      case 'post_updated':
        const postData = event.data as PostData;
        
        // Handle retweets: if main tweet text is empty and subtweet exists, use subtweet content
        const isRetweet = postData?.tweet?.type === 'RETWEET' && postData?.tweet?.subtweet;
        
        if (isRetweet && postData.tweet) {
          // For retweets, use subtweet content
          const subtweet = postData.tweet.subtweet;
          const originalAuthor = subtweet?.author?.handle || 'unknown';
          const originalText = subtweet?.body?.text || '';
          text = `RT @${originalAuthor}: ${originalText}`;
          
          // Extract media from subtweet
          if (subtweet?.media) {
            media = {
              images: subtweet.media.images,
              videos: subtweet.media.videos
            };
          }
          
          // Get avatar from subtweet author
          userAvatar = subtweet?.author?.profile?.avatar;
        } else if (postData?.tweet) {
          // For regular tweets, use main tweet content
          text = postData.tweet.body?.text || '';
          
          // Extract media from main tweet
          if (postData.tweet.media) {
            media = {
              images: postData.tweet.media.images,
              videos: postData.tweet.media.videos
            };
          }
          
          // Get user avatar from main tweet
          userAvatar = postData.tweet.author?.profile?.avatar;
        }
        
        // Build tweet URL (always use main tweet ID)
        if (postData?.tweet?.id) {
          tweetUrl = `https://twitter.com/${event.user.username}/status/${postData.tweet.id}`;
        }
        break;
        
      case 'user_updated':
      case 'profile_updated':
      case 'profile_pinned':
        const profileData = event.data as ProfileData;
        const profileAction = profileData?.action || 'updated';
        if (profileData?.pinned && profileData.pinned.length > 0) {
          text = `${profileAction}: pinned tweets updated`;
        } else {
          text = `profile ${profileAction}`;
        }
        
        // Get user avatar from profile
        userAvatar = profileData?.user?.profile?.avatar;
        break;
        
      case 'follow_created':
      case 'follow_updated':
        const followingData = event.data as FollowingData;
        const followAction = followingData?.action || '';
        
        // Determine if this is a follow or unfollow based on action field
        const isFollow = event.type === 'follow_created' || 
                        followAction === 'created' || 
                        followAction === 'follow' ||
                        followAction === 'follow_update';
        
        text = followingData?.following?.handle 
          ? (isFollow ? `followed @${followingData.following.handle}` : `unfollowed @${followingData.following.handle}`)
          : (isFollow ? 'followed a user' : 'unfollowed a user');
        break;
    }
  } catch (error) {
    text = 'event occurred';
  }

  return {
    eventType: event.type,
    username: event.user.username,
    text,
    timestamp: event.timestamp,
    media,
    tweetUrl,
    userAvatar
  };
}

/**
 * Format alert message
 */
export function formatAlertText(message: AlertMessage): string {
  // Get event emoji and label
  const eventEmoji = getEventEmoji(message.eventType);
  const eventLabel = getEventLabel(message.eventType);
  
  // Format timestamp to be more readable while keeping full precision
  const formattedTime = formatTimestamp(message.timestamp);
  
  // Use HTML formatting for better visual hierarchy
  return `${eventEmoji} <b>${eventLabel}</b>\n` +
         `👤 <b>@${message.username}</b>\n` +
         `${message.text}\n` +
         `🕐 ${formattedTime}`;
}

/**
 * Get emoji for event type
 */
function getEventEmoji(eventType: string): string {
  const emojiMap: Record<string, string> = {
    'post_created': '📝',
    'post_updated': '✏️',
    'follow_created': '➕',
    'follow_updated': '➖',
    'profile_updated': '👤',
    'profile_pinned': '📌',
    'user_updated': '👤'
  };
  return emojiMap[eventType] || '🔔';
}

/**
 * Get human-readable label for event type
 */
function getEventLabel(eventType: string): string {
  const labelMap: Record<string, string> = {
    'post_created': 'New Tweet',
    'post_updated': 'Tweet Updated',
    'follow_created': 'New Follow',
    'follow_updated': 'Unfollow',
    'profile_updated': 'Profile Update',
    'profile_pinned': 'Pinned Tweet',
    'user_updated': 'Profile Update'
  };
  return labelMap[eventType] || eventType;
}

/**
 * Format timestamp to be readable while keeping precision
 * Example: "2026-02-06 00:16:20 UTC"
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
  } catch {
    return timestamp;
  }
}

/**
 * Telegram alert channel using Bot API with rich formatting
 */
export class TelegramChannel implements AlertChannel {
  name = 'telegram';
  enabled: boolean;
  rateLimit: RateLimiter;
  
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string, enabled: boolean = true, maxAlertsPerMinute: number = 10) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.enabled = enabled;
    this.rateLimit = new RateLimiter(maxAlertsPerMinute, 60000);
  }

  async send(message: AlertMessage): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!this.rateLimit.allowRequest()) {
      console.warn(`[Telegram] Rate limit exceeded, dropping message`);
      return;
    }

    try {
      // If message has images, send as photo with caption
      if (message.media?.images && message.media.images.length > 0) {
        await this.sendPhoto(message);
      } else {
        // Otherwise send as text message
        await this.sendText(message);
      }

      this.rateLimit.recordRequest();
    } catch (error) {
      throw new Error(`Failed to send Telegram alert: ${error}`);
    }
  }

  /**
   * Send message as photo with caption and inline buttons
   */
  private async sendPhoto(message: AlertMessage): Promise<void> {
    const caption = this.formatCaption(message);
    const replyMarkup = this.createInlineKeyboard(message);
    const photoUrl = message.media!.images![0];
    
    const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
    
    const body: any = {
      chat_id: this.chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML'
    };

    // Add inline keyboard if we have buttons
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram sendPhoto error: ${response.status} ${errorText}`);
    }
  }

  /**
   * Send message as text with inline buttons
   */
  private async sendText(message: AlertMessage): Promise<void> {
    const text = this.formatCaption(message);
    const replyMarkup = this.createInlineKeyboard(message);
    
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    
    const body: any = {
      chat_id: this.chatId,
      text: text,
      parse_mode: 'HTML'
    };

    // Add inline keyboard if we have buttons
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram sendMessage error: ${response.status} ${errorText}`);
    }
  }

  /**
   * Format caption with rich HTML formatting
   * Telegram caption limit: 1024 characters
   */
  private formatCaption(message: AlertMessage): string {
    const eventEmoji = getEventEmoji(message.eventType);
    const eventLabel = getEventLabel(message.eventType);
    const formattedTime = formatTimestamp(message.timestamp);
    
    // Build caption with HTML formatting
    let caption = `${eventEmoji} <b>${eventLabel}</b>\n`;
    caption += `👤 <a href="https://twitter.com/${message.username}">@${message.username}</a>\n\n`;
    
    // Add tweet text if available
    if (message.text) {
      // Truncate if too long (leave room for other info)
      const maxTextLength = 800;
      const tweetText = message.text.length > maxTextLength 
        ? message.text.substring(0, maxTextLength) + '...'
        : message.text;
      caption += `${tweetText}\n\n`;
    }
    
    // Add media indicators
    if (message.media?.images && message.media.images.length > 1) {
      caption += `🖼️ <i>${message.media.images.length} images</i>\n`;
    }
    if (message.media?.videos && message.media.videos.length > 0) {
      caption += `🎥 <i>${message.media.videos.length} video(s)</i>\n`;
    }
    
    // Add timestamp
    caption += `\n🕐 <code>${formattedTime}</code>`;
    
    // Ensure we don't exceed Telegram's 1024 character limit
    if (caption.length > 1024) {
      caption = caption.substring(0, 1020) + '...';
    }
    
    return caption;
  }

  /**
   * Create inline keyboard with action buttons
   */
  private createInlineKeyboard(message: AlertMessage): any | null {
    const buttons: any[] = [];
    
    // Add "View Tweet" button if we have a tweet URL
    if (message.tweetUrl) {
      buttons.push([{
        text: '🔗 View Tweet',
        url: message.tweetUrl
      }]);
    }
    
    // Add "View Profile" button
    buttons.push([{
      text: '👤 View Profile',
      url: `https://twitter.com/${message.username}`
    }]);
    
    // Return null if no buttons
    if (buttons.length === 0) {
      return null;
    }
    
    return {
      inline_keyboard: buttons
    };
  }
}

/**
 * Discord alert channel using webhooks with rich embeds
 */
export class DiscordChannel implements AlertChannel {
  name = 'discord';
  enabled: boolean;
  rateLimit: RateLimiter;
  
  private webhookUrl: string;

  constructor(webhookUrl: string, enabled: boolean = true, maxAlertsPerMinute: number = 10) {
    this.webhookUrl = webhookUrl;
    this.enabled = enabled;
    this.rateLimit = new RateLimiter(maxAlertsPerMinute, 60000);
  }

  async send(message: AlertMessage): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!this.rateLimit.allowRequest()) {
      console.warn(`[Discord] Rate limit exceeded, dropping message`);
      return;
    }

    // Create rich embed for Discord
    const embed = this.createEmbed(message);
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embeds: [embed]
        })
      });

      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status} ${response.statusText}`);
      }

      this.rateLimit.recordRequest();
    } catch (error) {
      throw new Error(`Failed to send Discord alert: ${error}`);
    }
  }

  /**
   * Create a rich embed for Discord with media support
   */
  private createEmbed(message: AlertMessage): any {
    const eventEmoji = getEventEmoji(message.eventType);
    const eventLabel = getEventLabel(message.eventType);
    const color = this.getEventColor(message.eventType);
    
    // Format timestamp for Discord (ISO 8601)
    const timestamp = new Date(message.timestamp).toISOString();
    
    // Build base embed
    const embed: any = {
      color: color,
      timestamp: timestamp,
      author: {
        name: `${eventEmoji} ${eventLabel} • @${message.username}`,
        url: `https://twitter.com/${message.username}`
      },
      footer: {
        text: 'Crypto Twitter Alpha Stream',
        icon_url: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
      }
    };

    // Add user avatar as thumbnail if available
    if (message.userAvatar) {
      embed.thumbnail = {
        url: message.userAvatar
      };
    }

    // Add content based on length
    if (message.text) {
      if (message.text.length <= 300) {
        embed.description = message.text;
      } else {
        // For long tweets, truncate
        embed.description = message.text.substring(0, 297) + '...';
      }
    }

    // Add tweet link if available
    if (message.tweetUrl) {
      if (!embed.fields) embed.fields = [];
      embed.fields.push({
        name: '🔗 View Tweet',
        value: `[Open on Twitter](${message.tweetUrl})`,
        inline: true
      });
    }

    // Add first image as main embed image (Discord shows this large)
    if (message.media?.images && message.media.images.length > 0) {
      embed.image = {
        url: message.media.images[0]
      };
      
      // If multiple images, add field noting additional images
      if (message.media.images.length > 1) {
        if (!embed.fields) embed.fields = [];
        embed.fields.push({
          name: '🖼️ Media',
          value: `${message.media.images.length} images`,
          inline: true
        });
      }
    }

    // Add video indicator if present
    if (message.media?.videos && message.media.videos.length > 0) {
      if (!embed.fields) embed.fields = [];
      embed.fields.push({
        name: '🎥 Video',
        value: `${message.media.videos.length} video(s) - [View on Twitter](${message.tweetUrl || `https://twitter.com/${message.username}`})`,
        inline: false
      });
    }
    
    return embed;
  }

  /**
   * Get color for event type using Discord's official color palette
   * Colors optimized for both dark and light modes
   */
  private getEventColor(eventType: string): number {
    const colorMap: Record<string, number> = {
      // New content - Discord Blue (vibrant, attention-grabbing)
      'post_created': 5793266,      // Blurple (#5865F2) - Discord's brand color
      
      // Updates - Discord Yellow (warning/update color)
      'post_updated': 16705372,     // Yellow (#FEE75C)
      
      // Positive actions - Discord Green
      'follow_created': 5763719,    // Green (#57F287)
      
      // Negative actions - Discord Red
      'follow_updated': 15548997,   // Red (#ED4245)
      
      // Profile changes - Discord Fuchsia (stands out)
      'profile_updated': 15418782,  // Fuchsia (#EB459E)
      'profile_pinned': 15418782,   // Fuchsia (#EB459E)
      'user_updated': 15418782      // Fuchsia (#EB459E)
    };
    
    // Default: Discord Greyple (neutral)
    return colorMap[eventType] || 10070709; // Greyple (#99AAB5)
  }
}

/**
 * Generic webhook alert channel
 */
export class WebhookChannel implements AlertChannel {
  name = 'webhook';
  enabled: boolean;
  rateLimit: RateLimiter;
  
  private url: string;
  private method: 'POST' | 'PUT';
  private headers: Record<string, string>;

  constructor(
    url: string,
    method: 'POST' | 'PUT' = 'POST',
    headers: Record<string, string> = {},
    enabled: boolean = true,
    maxAlertsPerMinute: number = 10
  ) {
    this.url = url;
    this.method = method;
    this.headers = headers;
    this.enabled = enabled;
    this.rateLimit = new RateLimiter(maxAlertsPerMinute, 60000);
  }

  async send(message: AlertMessage): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (!this.rateLimit.allowRequest()) {
      console.warn(`[Webhook] Rate limit exceeded, dropping message`);
      return;
    }

    try {
      const response = await fetch(this.url, {
        method: this.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }

      this.rateLimit.recordRequest();
    } catch (error) {
      throw new Error(`Failed to send webhook alert: ${error}`);
    }
  }
}
