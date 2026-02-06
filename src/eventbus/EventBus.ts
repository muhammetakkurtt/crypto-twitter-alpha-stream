/**
 * EventBus - Pub/Sub mechanism for broadcasting events to multiple outputs
 * 
 * Supports multiple subscribers per channel with async handler support.
 * Failed handlers are isolated and don't affect other subscribers.
 */

import { TwitterEvent } from '../models/types';

export type EventHandler = (event: TwitterEvent) => void | Promise<void>;

export interface Subscription {
  id: string;
  channel: string;
  handler: EventHandler;
}

export class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private nextSubscriptionId: number = 1;

  /**
   * Subscribe to a channel with a handler
   * @param channel - The channel name (e.g., 'cli', 'dashboard', 'alerts')
   * @param handler - The event handler function
   * @returns Subscription ID for unsubscribing
   */
  subscribe(channel: string, handler: EventHandler): string {
    const subscriptionId = `sub_${this.nextSubscriptionId++}`;
    
    const subscription: Subscription = {
      id: subscriptionId,
      channel,
      handler
    };

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }

    this.subscriptions.get(channel)!.push(subscription);
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from a channel
   * @param subscriptionId - The subscription ID returned from subscribe
   */
  unsubscribe(subscriptionId: string): void {
    for (const [channel, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(channel);
        }
        return;
      }
    }
  }

  /**
   * Publish an event to all subscribers of a channel
   * @param channel - The channel name
   * @param event - The Twitter event to publish
   */
  async publish(channel: string, event: TwitterEvent): Promise<void> {
    const subs = this.subscriptions.get(channel);
    
    if (!subs || subs.length === 0) {
      return;
    }

    // Execute all handlers, isolating errors
    const promises = subs.map(async (sub) => {
      try {
        await sub.handler(event);
      } catch (error) {
        // Log error but don't throw - isolate handler failures
        console.error(`Error in handler ${sub.id} for channel ${channel}:`, error);
      }
    });

    // Wait for all handlers to complete
    await Promise.all(promises);
  }

  /**
   * Get the number of subscribers for a channel
   * @param channel - The channel name
   * @returns Number of subscribers
   */
  getSubscriberCount(channel: string): number {
    return this.subscriptions.get(channel)?.length ?? 0;
  }

  /**
   * Get all active channels
   * @returns Array of channel names
   */
  getChannels(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
  }
}
