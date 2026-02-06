import ioClient from 'socket.io-client';
import { eventsStore } from './events.svelte';
import { statsStore } from './stats.svelte';
import { toastStore } from './toast.svelte';
import { notifyForImportantEvent } from '$lib/utils/eventNotifications';
import type { TwitterEvent } from '$lib/types';

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
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatus = 'disconnected';
    }
  }
}

export const socketStore = new SocketStore();
