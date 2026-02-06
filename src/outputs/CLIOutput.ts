/**
 * CLIOutput - Terminal-based output for live event streaming
 * 
 * Displays events in single-line format with periodic statistics.
 * Subscribes to the EventBus 'cli' channel.
 */

import { TwitterEvent } from '../models/types';
import { EventBus } from '../eventbus/EventBus';

export interface CLIConfig {
  statsInterval: number;  // ms between stat displays
  colorEnabled: boolean;
}

export interface CLIStats {
  total: number;
  delivered: number;
  deduped: number;
  startTime: Date;
}

export class CLIOutput {
  private eventBus: EventBus;
  private config: CLIConfig;
  private stats: CLIStats;
  private subscriptionId: string | null = null;
  private statsIntervalId: NodeJS.Timeout | null = null;

  constructor(eventBus: EventBus, config: Partial<CLIConfig> = {}) {
    this.eventBus = eventBus;
    this.config = {
      statsInterval: config.statsInterval ?? 60000,  // Default 60 seconds
      colorEnabled: config.colorEnabled ?? true
    };
    this.stats = {
      total: 0,
      delivered: 0,
      deduped: 0,
      startTime: new Date()
    };
  }

  /**
   * Start the CLI output
   * Subscribes to the 'cli' channel and starts periodic stats display
   */
  start(): void {
    if (this.subscriptionId) {
      return;  // Already started
    }

    // Subscribe to the 'cli' channel
    this.subscriptionId = this.eventBus.subscribe('cli', (event) => {
      this.handleEvent(event);
    });

    // Start periodic stats display
    this.statsIntervalId = setInterval(() => {
      this.displayStats();
    }, this.config.statsInterval);

    console.log('CLI Output started');
  }

  /**
   * Stop the CLI output
   * Unsubscribes from the event bus and stops stats display
   */
  stop(): void {
    if (this.subscriptionId) {
      this.eventBus.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }

    console.log('CLI Output stopped');
  }

  /**
   * Handle an incoming event
   * Formats and prints the event, updates counters
   */
  handleEvent(event: TwitterEvent): void {
    this.stats.total++;
    this.stats.delivered++;

    const formattedEvent = this.formatEvent(event);
    console.log(formattedEvent);
  }

  /**
   * Format an event as a single line
   * Format: [event_type] @username: text
   */
  private formatEvent(event: TwitterEvent): string {
    const eventType = event.type;
    const username = event.user.username;
    
    let text = '';
    
    try {
      if (event.type === 'post_created' || event.type === 'post_updated') {
        // Extract tweet text from nested structure
        const tweetText = (event.data as any).tweet?.body?.text || 'No text available';
        text = this.truncateText(tweetText, 100);
        
      } else if (event.type === 'user_updated' || event.type === 'profile_updated' || event.type === 'profile_pinned') {
        // Extract action type
        const action = (event.data as any).action || 'updated';
        
        // Check for pinned tweets
        if ((event.data as any).pinned && (event.data as any).pinned.length > 0) {
          text = `${action}: pinned tweets updated`;
        } else {
          text = `profile ${action}`;
        }
        
      } else if (event.type === 'follow_created') {
        // Extract target from nested structure
        const targetUsername = (event.data as any).following?.handle || 'unknown';
        text = `followed @${targetUsername}`;
        
      } else if (event.type === 'follow_updated') {
        const targetUsername = (event.data as any).following?.handle || 'unknown';
        text = `unfollowed @${targetUsername}`;
      }
    } catch (error) {
      // Handle any extraction errors gracefully
      console.error('[CLIOutput] Error formatting event:', error);
      text = 'Error formatting event';
    }

    // Single-line format without newlines
    const singleLineText = text.replace(/\n/g, ' ').replace(/\r/g, '');
    
    return `[${eventType}] @${username}: ${singleLineText}`;
  }

  /**
   * Truncate text to a maximum length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Display summary statistics
   */
  displayStats(): void {
    const now = new Date();
    const elapsedSeconds = (now.getTime() - this.stats.startTime.getTime()) / 1000;
    const rate = elapsedSeconds > 0 ? (this.stats.total / elapsedSeconds).toFixed(2) : '0.00';

    console.log('');
    console.log('--- Stats ---');
    console.log(`events_total=${this.stats.total}  delivered=${this.stats.delivered}  deduped=${this.stats.deduped}  rate=${rate}/s`);
    console.log('');
  }

  /**
   * Increment the deduped counter
   * Called externally when a duplicate is detected
   */
  incrementDeduped(): void {
    this.stats.deduped++;
  }

  /**
   * Get current statistics
   */
  getStats(): CLIStats {
    return { ...this.stats };
  }
}
