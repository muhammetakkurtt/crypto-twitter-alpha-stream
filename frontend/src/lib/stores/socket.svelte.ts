import ioClient from 'socket.io-client';
import { eventsStore } from './events.svelte';
import { statsStore } from './stats.svelte';
import { toastStore } from './toast.svelte';
import { subscriptionStore } from './subscription.svelte';
import { notifyForImportantEvent } from '$lib/utils/eventNotifications';
import type { TwitterEvent, RuntimeSubscriptionState, UpdateRuntimeSubscriptionPayload } from '$lib/types';

type Socket = ReturnType<typeof ioClient>;
type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface StatePayload {
  events?: TwitterEvent[];
  activeUsers?: string[];
  stats?: {
    total?: number;
    delivered?: number;
    deduped?: number;
  };
}

class SocketStore {
  socket = $state<Socket | null>(null);
  connectionStatus = $state<ConnectionStatus>('disconnected');
  activeUsers = $state<string[]>([]);
  
  connect() {
    if (this.socket?.connected) {
      return;
    }
    
    this.socket = ioClient({
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    
    this.socket.on('connect', () => {
      this.connectionStatus = 'connected';
      toastStore.success('Connected to event stream');
    });
    
    this.socket.on('disconnect', () => {
      this.connectionStatus = 'disconnected';
      toastStore.error('Disconnected from event stream');
    });
    
    this.socket.on('reconnect', () => {
      toastStore.success('Reconnected to event stream');
    });
    
    this.socket.on('connect_error', (error: Error) => {
      toastStore.error(`Connection error: ${error.message}`);
    });
    
    this.socket.on('event', (event: TwitterEvent) => {
      eventsStore.addEvent(event);
      statsStore.incrementTotal();
      notifyForImportantEvent(event);
    });
    
    this.socket.on('state', (state: StatePayload) => {
      if (state.events && Array.isArray(state.events)) {
        state.events.forEach(event => eventsStore.addEvent(event));
      }
      
      if (state.activeUsers && Array.isArray(state.activeUsers)) {
        this.activeUsers = state.activeUsers;
      }
      
      if (state.stats) {
        statsStore.updateFromState(state.stats);
      }
    });
    
    this.socket.on('activeUsers', (users: string[]) => {
      this.activeUsers = users;
    });
    
    this.socket.on('runtimeSubscriptionUpdated', (state: RuntimeSubscriptionState) => {
      subscriptionStore.initialize(state);
      toastStore.info('Subscription updated');
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatus = 'disconnected';
    }
  }
  
  /**
   * Get current runtime subscription state
   */
  async getRuntimeSubscription(): Promise<RuntimeSubscriptionState> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Set up timeout (10 seconds)
      const timeoutId = setTimeout(() => {
        reject(new Error('getRuntimeSubscription timeout after 10000ms'));
      }, 10000);

      this.socket.emit('getRuntimeSubscription', (response: any) => {
        clearTimeout(timeoutId);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.data);
        }
      });
    });
  }

  /**
   * Update runtime subscription
   */
  async setRuntimeSubscription(
    payload: UpdateRuntimeSubscriptionPayload
  ): Promise<RuntimeSubscriptionState> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Set up timeout (10 seconds)
      const timeoutId = setTimeout(() => {
        reject(new Error('setRuntimeSubscription timeout after 10000ms'));
      }, 10000);

      this.socket.emit('setRuntimeSubscription', payload, (response: any) => {
        clearTimeout(timeoutId);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.data);
        }
      });
    });
  }
}

export const socketStore = new SocketStore();
