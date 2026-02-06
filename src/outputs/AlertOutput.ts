/**
 * AlertOutput - Manages alert channels and sends notifications
 * 
 * Subscribes to the EventBus 'alerts' channel and distributes events
 * to configured alert channels (Telegram, Discord, Webhook) with error isolation.
 */

import { TwitterEvent } from '../models/types';
import { EventBus } from '../eventbus/EventBus';
import { AlertChannel, formatAlertMessage } from './AlertChannel';

export interface AlertOutputConfig {
  channels: AlertChannel[];
}

export class AlertOutput {
  private channels: AlertChannel[];
  private eventBus: EventBus;
  private subscriptionId?: string;
  private stats: {
    telegram: { sent: number; failed: number };
    discord: { sent: number; failed: number };
    webhook: { sent: number; failed: number };
  };

  constructor(config: AlertOutputConfig, eventBus: EventBus) {
    this.channels = config.channels;
    this.eventBus = eventBus;
    this.stats = {
      telegram: { sent: 0, failed: 0 },
      discord: { sent: 0, failed: 0 },
      webhook: { sent: 0, failed: 0 }
    };
  }

  /**
   * Start the alert output by subscribing to the EventBus
   */
  start(): void {
    this.subscriptionId = this.eventBus.subscribe('alerts', this.handleEvent.bind(this));
    console.log('[AlertOutput] Started with channels:', this.channels.map(c => c.name).join(', '));
  }

  /**
   * Stop the alert output by unsubscribing from the EventBus
   */
  stop(): void {
    if (this.subscriptionId) {
      this.eventBus.unsubscribe(this.subscriptionId);
      this.subscriptionId = undefined;
    }
    console.log('[AlertOutput] Stopped');
  }

  /**
   * Handle an event from the EventBus
   * @param event - The Twitter event to process
   */
  private async handleEvent(event: TwitterEvent): Promise<void> {
    const message = formatAlertMessage(event);

    // Send to all enabled channels independently
    const promises = this.channels.map(async (channel) => {
      if (!channel.enabled) {
        return;
      }

      try {
        await channel.send(message);
        this.incrementStat(channel.name, 'sent');
      } catch (error) {
        // Log error but don't throw - isolate channel failures
        console.error(`[AlertOutput] Error sending to ${channel.name}:`, error);
        this.incrementStat(channel.name, 'failed');
      }
    });

    // Wait for all channels to complete
    await Promise.all(promises);
  }

  /**
   * Increment a stat counter for a channel
   */
  private incrementStat(channelName: string, stat: 'sent' | 'failed'): void {
    if (channelName === 'telegram') {
      this.stats.telegram[stat]++;
    } else if (channelName === 'discord') {
      this.stats.discord[stat]++;
    } else if (channelName === 'webhook') {
      this.stats.webhook[stat]++;
    }
  }

  /**
   * Get alert statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      telegram: { sent: 0, failed: 0 },
      discord: { sent: 0, failed: 0 },
      webhook: { sent: 0, failed: 0 }
    };
  }
}
