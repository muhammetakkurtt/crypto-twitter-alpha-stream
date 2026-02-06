# Store API Documentation

This document describes the state management stores used in the Crypto Twitter Alpha Stream frontend. All stores are built using Svelte 5's Runes system for optimal reactivity and performance.

## Table of Contents

- [Events Store](#events-store)
- [Socket Store](#socket-store)
- [Filters Store](#filters-store)
- [Stats Store](#stats-store)
- [Search Store](#search-store)
- [Toast Store](#toast-store)

---

## Events Store

**Location**: `src/lib/stores/events.svelte.ts`

Manages the collection of Twitter events received from the backend.

### State

```typescript
class EventStore {
  events: TwitterEvent[]           // Array of all events
  eventMap: Map<string, TwitterEvent>  // Map for quick lookups by ID
}
```

### Derived State

```typescript
filteredEvents: TwitterEvent[]  // Events filtered by current filter criteria
```

### Methods

#### `addEvent(event: TwitterEvent): void`

Adds a new event to the store. If an event with the same `primaryId` already exists, it updates the existing event instead.

**Parameters:**
- `event`: The Twitter event to add

**Example:**
```typescript
import { eventsStore } from '$lib/stores/events.svelte';

eventsStore.addEvent({
  primaryId: '123',
  type: 'post_created',
  timestamp: Date.now(),
  user: { username: 'elonmusk', ... },
  data: { tweet: { ... } }
});
```

#### `updateEvent(event: TwitterEvent): void`

Updates an existing event in the store.

**Parameters:**
- `event`: The updated event data

**Example:**
```typescript
eventsStore.updateEvent({
  primaryId: '123',
  type: 'post_updated',
  // ... updated fields
});
```

#### `clear(): void`

Removes all events from the store.

**Example:**
```typescript
eventsStore.clear();
```

### Usage in Components

```svelte
<script lang="ts">
  import { eventsStore } from '$lib/stores/events.svelte';
  
  // Access reactive state
  const events = $derived(eventsStore.filteredEvents);
</script>

{#each events as event}
  <EventCard {event} />
{/each}
```

---

## Socket Store

**Location**: `src/lib/stores/socket.svelte.ts`

Manages the Socket.IO connection to the backend server.

### State

```typescript
class SocketStore {
  socket: Socket | null                    // Socket.IO instance
  connectionStatus: ConnectionStatus       // 'connected' | 'disconnected' | 'reconnecting'
  endpoint: string                         // Current endpoint URL
}
```

### Methods

#### `connect(endpoint?: string): void`

Establishes a Socket.IO connection to the backend.

**Parameters:**
- `endpoint` (optional): The backend URL to connect to. Defaults to current host.

**Example:**
```typescript
import { socketStore } from '$lib/stores/socket.svelte';

socketStore.connect('http://localhost:3000');
```

**Events Handled:**
- `connect`: Updates status to 'connected'
- `disconnect`: Updates status to 'disconnected'
- `event`: Adds received event to events store
- `state`: Syncs initial state from backend

#### `disconnect(): void`

Closes the Socket.IO connection.

**Example:**
```typescript
socketStore.disconnect();
```

#### `changeEndpoint(endpoint: string): void`

Switches to a different backend endpoint.

**Parameters:**
- `endpoint`: The new backend URL

**Example:**
```typescript
socketStore.changeEndpoint('http://localhost:4000');
```

### Usage in Components

```svelte
<script lang="ts">
  import { socketStore } from '$lib/stores/socket.svelte';
  import { onMount } from 'svelte';
  
  onMount(() => {
    socketStore.connect();
    
    return () => {
      socketStore.disconnect();
    };
  });
  
  const status = $derived(socketStore.connectionStatus);
</script>

<div class="status-{status}">
  {status === 'connected' ? 'Connected' : 'Disconnected'}
</div>
```

---

## Filters Store

**Location**: `src/lib/stores/filters.svelte.ts`

Manages filtering criteria for events.

### State

```typescript
class FilterStore {
  keywords: string[]        // Keywords to filter by
  eventTypes: string[]      // Event types to display
  users: string[]           // Usernames to filter by
}
```

### Derived State

```typescript
hasActiveFilters: boolean  // True if any filters are active
```

### Methods

#### `setKeywords(keywords: string[]): void`

Sets the keyword filter.

**Parameters:**
- `keywords`: Array of keywords to filter by

**Example:**
```typescript
import { filtersStore } from '$lib/stores/filters.svelte';

filtersStore.setKeywords(['bitcoin', 'ethereum']);
```

#### `toggleEventType(type: string): void`

Toggles an event type filter on/off.

**Parameters:**
- `type`: The event type to toggle

**Example:**
```typescript
filtersStore.toggleEventType('post_created');
```

#### `toggleUser(username: string): void`

Toggles a user filter on/off.

**Parameters:**
- `username`: The username to toggle

**Example:**
```typescript
filtersStore.toggleUser('elonmusk');
```

#### `shouldDisplayEvent(event: TwitterEvent): boolean`

Determines if an event should be displayed based on current filters.

**Parameters:**
- `event`: The event to check

**Returns:**
- `true` if the event matches all filter criteria

**Example:**
```typescript
const shouldShow = filtersStore.shouldDisplayEvent(event);
```

#### `clearAll(): void`

Removes all active filters.

**Example:**
```typescript
filtersStore.clearAll();
```

### Usage in Components

```svelte
<script lang="ts">
  import { filtersStore } from '$lib/stores/filters.svelte';
  
  const hasFilters = $derived(filtersStore.hasActiveFilters);
  
  function handleUserClick(username: string) {
    filtersStore.toggleUser(username);
  }
</script>

<button onclick={() => handleUserClick('elonmusk')}>
  Filter by @elonmusk
</button>

{#if hasFilters}
  <button onclick={() => filtersStore.clearAll()}>
    Clear Filters
  </button>
{/if}
```

---

## Stats Store

**Location**: `src/lib/stores/stats.svelte.ts`

Tracks statistics about the event stream.

### State

```typescript
class StatsStore {
  total: number         // Total events received
  delivered: number     // Events delivered (not deduped)
  deduped: number       // Events deduplicated
  startTime: number     // Timestamp when tracking started
}
```

### Derived State

```typescript
eventsPerMin: string  // Events per minute rate (formatted)
```

### Methods

#### `incrementTotal(): void`

Increments the total and delivered counters.

**Example:**
```typescript
import { statsStore } from '$lib/stores/stats.svelte';

statsStore.incrementTotal();
```

#### `incrementDeduped(): void`

Increments the total and deduped counters.

**Example:**
```typescript
statsStore.incrementDeduped();
```

#### `updateFromState(state: any): void`

Updates stats from backend state sync.

**Parameters:**
- `state`: State object from backend

**Example:**
```typescript
statsStore.updateFromState({
  total: 100,
  delivered: 95,
  deduped: 5
});
```

#### `reset(): void`

Resets all counters to zero.

**Example:**
```typescript
statsStore.reset();
```

### Usage in Components

```svelte
<script lang="ts">
  import { statsStore } from '$lib/stores/stats.svelte';
  
  const eventsPerMin = $derived(statsStore.eventsPerMin);
  const total = $derived(statsStore.total);
</script>

<div class="stats">
  <div>Events/min: {eventsPerMin}</div>
  <div>Total: {total}</div>
</div>
```

---

## Search Store

**Location**: `src/lib/stores/search.svelte.ts`

Manages search functionality and history.

### State

```typescript
class SearchStore {
  query: string           // Current search query
  history: string[]       // Search history
  isActive: boolean       // Whether search is active
}
```

### Derived State

```typescript
hasResults: boolean     // True if search has results
```

### Methods

#### `setQuery(query: string): void`

Sets the current search query.

**Parameters:**
- `query`: The search string

**Example:**
```typescript
import { searchStore } from '$lib/stores/search.svelte';

searchStore.setQuery('bitcoin');
```

#### `addToHistory(query: string): void`

Adds a query to search history.

**Parameters:**
- `query`: The search string to save

**Example:**
```typescript
searchStore.addToHistory('ethereum');
```

#### `clearHistory(): void`

Clears all search history.

**Example:**
```typescript
searchStore.clearHistory();
```

#### `activate(): void`

Activates search mode.

**Example:**
```typescript
searchStore.activate();
```

#### `deactivate(): void`

Deactivates search mode and clears query.

**Example:**
```typescript
searchStore.deactivate();
```

### Usage in Components

```svelte
<script lang="ts">
  import { searchStore } from '$lib/stores/search.svelte';
  
  let searchInput = $state('');
  
  function handleSearch() {
    searchStore.setQuery(searchInput);
    searchStore.addToHistory(searchInput);
  }
</script>

<input 
  bind:value={searchInput}
  onfocus={() => searchStore.activate()}
  placeholder="Search events..."
/>
```

---

## Toast Store

**Location**: `src/lib/stores/toast.svelte.ts`

Manages toast notifications.

### State

```typescript
class ToastStore {
  toasts: Toast[]  // Array of active toasts
}
```

### Types

```typescript
interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration: number
}
```

### Methods

#### `show(message: string, type?: ToastType, duration?: number): void`

Displays a toast notification.

**Parameters:**
- `message`: The message to display
- `type` (optional): Toast type. Default: 'info'
- `duration` (optional): Duration in ms. Default: 3000

**Example:**
```typescript
import { toastStore } from '$lib/stores/toast.svelte';

toastStore.show('Connected to server', 'success');
toastStore.show('Connection lost', 'error', 5000);
```

#### `dismiss(id: string): void`

Dismisses a specific toast.

**Parameters:**
- `id`: The toast ID to dismiss

**Example:**
```typescript
toastStore.dismiss('toast-123');
```

#### `clear(): void`

Dismisses all toasts.

**Example:**
```typescript
toastStore.clear();
```

### Usage in Components

```svelte
<script lang="ts">
  import { toastStore } from '$lib/stores/toast.svelte';
  
  function handleAction() {
    try {
      // ... some action
      toastStore.show('Action completed', 'success');
    } catch (error) {
      toastStore.show('Action failed', 'error');
    }
  }
</script>
```

---

## Best Practices

### 1. Accessing Store State

Always use `$derived` to access store state in components:

```svelte
<script lang="ts">
  import { eventsStore } from '$lib/stores/events.svelte';
  
  // ✅ Good - reactive
  const events = $derived(eventsStore.filteredEvents);
  
  // ❌ Bad - not reactive
  const events = eventsStore.filteredEvents;
</script>
```

### 2. Modifying Store State

Call store methods directly, don't try to mutate state:

```typescript
// ✅ Good
eventsStore.addEvent(newEvent);

// ❌ Bad
eventsStore.events.push(newEvent);
```

### 3. Cleanup

Always disconnect sockets and clear subscriptions:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { socketStore } from '$lib/stores/socket.svelte';
  
  onMount(() => {
    socketStore.connect();
    
    return () => {
      socketStore.disconnect();
    };
  });
</script>
```

### 4. Performance

Use derived state for computed values instead of recalculating in components:

```typescript
// ✅ Good - computed once in store
const filteredEvents = $derived(eventsStore.filteredEvents);

// ❌ Bad - recalculated on every render
const filteredEvents = events.filter(e => filtersStore.shouldDisplayEvent(e));
```

### 5. Type Safety

Always use TypeScript types for store data:

```typescript
import type { TwitterEvent } from '$lib/types';

function addEvent(event: TwitterEvent) {
  eventsStore.addEvent(event);
}
```

---

## Testing Stores

All stores include comprehensive unit tests. To run store tests:

```bash
npm test -- stores
```

Example test:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { eventsStore } from '$lib/stores/events.svelte';

describe('EventStore', () => {
  beforeEach(() => {
    eventsStore.clear();
  });
  
  it('should add new event', () => {
    const event = { primaryId: '123', type: 'post_created', ... };
    eventsStore.addEvent(event);
    expect(eventsStore.events).toHaveLength(1);
  });
});
```
