# Component Usage Guide

This document provides detailed usage instructions for all components in the Crypto Twitter Alpha Stream frontend.

## Table of Contents

- [Layout Components](#layout-components)
- [Feed Components](#feed-components)
- [Card Components](#card-components)
- [Panel Components](#panel-components)
- [UI Components](#ui-components)
- [Modal Components](#modal-components)

---

## Layout Components

### MainLayout

**Location**: `src/lib/components/MainLayout.svelte`

Main application layout with responsive 3-column grid.

**Props**: None (uses slots)

**Usage**:
```svelte
<script>
  import MainLayout from '$lib/components/MainLayout.svelte';
  import UserList from '$lib/components/UserList.svelte';
  import EventFeed from '$lib/components/EventFeed.svelte';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
</script>

<MainLayout>
  {#snippet left()}
    <UserList />
  {/snippet}
  
  {#snippet center()}
    <EventFeed />
  {/snippet}
  
  {#snippet right()}
    <FilterPanel />
    <StatsPanel />
  {/snippet}
</MainLayout>
```

**Features**:
- Responsive breakpoints (mobile, tablet, desktop)
- Sticky positioning for side panels
- Smooth scrolling
- Optimized for performance

**Styling**:
- Uses CSS Grid for layout
- Adapts to screen size automatically
- Mobile: Single column
- Tablet: 2 columns
- Desktop: 3 columns

---

## Feed Components

### EventFeed

**Location**: `src/lib/components/EventFeed.svelte`

Displays a scrollable feed of real-time events with virtual scrolling.

**Props**: None (uses stores)

**Usage**:
```svelte
<script>
  import EventFeed from '$lib/components/EventFeed.svelte';
</script>

<EventFeed />
```

**Features**:
- Virtual scrolling for performance (activates at 100+ events)
- Auto-scroll to top for new events
- Empty state when no events
- Loading state during initial connection
- Smooth animations for new events

**Stores Used**:
- `eventsStore.filteredEvents` - Gets filtered events to display
- `socketStore.connectionStatus` - Shows connection state

**Performance**:
- Only renders visible items + buffer
- Reuses DOM elements
- Handles 1000+ events smoothly

**Customization**:
```typescript
// Adjust virtual scrolling parameters
const ITEM_HEIGHT = 200;  // Average item height
const BUFFER = 5;         // Extra items to render
```

---

### UserList

**Location**: `src/lib/components/UserList.svelte`

Displays active users with search and filter capabilities.

**Props**:
```typescript
interface UserListProps {
  users?: string[];  // Optional: Override users from events
}
```

**Usage**:
```svelte
<script>
  import UserList from '$lib/components/UserList.svelte';
</script>

<!-- Use with automatic user detection -->
<UserList />

<!-- Or provide custom user list -->
<UserList users={['elonmusk', 'VitalikButerin']} />
```

**Features**:
- Real-time search filtering
- Click to toggle user filter
- Visual indicator for filtered users
- Keyboard navigation (arrow keys, Enter)
- Displays user count

**Interactions**:
- Click username: Toggle filter for that user
- Type in search: Filter displayed users
- Clear search: Show all users

**Styling**:
- Glassmorphism card effect
- Hover effects on user items
- Active state for filtered users
- Smooth transitions

---

## Card Components

### TweetCard

**Location**: `src/lib/components/TweetCard.svelte`

Displays tweet events with rich content.

**Props**:
```typescript
interface TweetCardProps {
  event: TwitterEvent;  // Event with type 'post_created' or 'post_updated'
}
```

**Usage**:
```svelte
<script>
  import TweetCard from '$lib/components/TweetCard.svelte';
  
  const event = {
    type: 'post_created',
    timestamp: Date.now(),
    user: {
      username: 'elonmusk',
      profile: { name: 'Elon Musk', avatar: '...' }
    },
    data: {
      tweet: {
        id: '123',
        body: { text: 'Hello world', mentions: [] },
        author: { handle: 'elonmusk', profile: { ... } },
        media: { images: [...] }
      }
    }
  };
</script>

<TweetCard {event} />
```

**Features**:
- Author section with avatar and profile link
- Tweet text with mention highlighting
- Media grid (1-4 images)
- Video player support
- Quoted tweet rendering
- Action buttons (view on Twitter)
- Timestamp display

**Interactions**:
- Click mention: Add user to filter
- Click image: Open full-size modal
- Click "View on Twitter": Open tweet in new tab

**Styling**:
- Glassmorphism card
- Glow effect on interactive elements
- Smooth transitions

---

### ProfileCard

**Location**: `src/lib/components/ProfileCard.svelte`

Displays profile update events.

**Props**:
```typescript
interface ProfileCardProps {
  event: TwitterEvent;  // Event with type 'profile_updated' or 'profile_update'
}
```

**Usage**:
```svelte
<script>
  import ProfileCard from '$lib/components/ProfileCard.svelte';
  
  const event = {
    type: 'profile_updated',
    user: { username: 'elonmusk', ... },
    data: {
      profile: {
        name: 'Elon Musk',
        bio: 'CEO of Tesla',
        avatar: '...',
        banner: '...',
        pinnedTweet: { ... }
      }
    }
  };
</script>

<ProfileCard {event} />
```

**Features**:
- Avatar display
- Banner image
- Profile information (name, bio, location)
- Pinned tweet section
- Profile change indicators
- Follower/following counts

**Styling**:
- Large banner image
- Circular avatar
- Glassmorphism overlay
- Smooth animations

---

### FollowCard

**Location**: `src/lib/components/FollowCard.svelte`

Displays follow/unfollow events.

**Props**:
```typescript
interface FollowCardProps {
  event: TwitterEvent;  // Event with type 'follow_created' or 'follow_updated'
}
```

**Usage**:
```svelte
<script>
  import FollowCard from '$lib/components/FollowCard.svelte';
  
  const event = {
    type: 'follow_created',
    user: { username: 'elonmusk', ... },
    data: {
      follow: {
        follower: { handle: 'user1', profile: { ... } },
        followee: { handle: 'user2', profile: { ... } }
      }
    }
  };
</script>

<FollowCard {event} />
```

**Features**:
- Follower section (left)
- Arrow indicator (center)
- Followee section (right)
- User metrics (followers, following)
- Profile links

**Styling**:
- Horizontal layout
- Arrow animation
- Glassmorphism cards
- Hover effects

---

## Panel Components

### FilterPanel

**Location**: `src/lib/components/FilterPanel.svelte`

Provides filtering controls for events.

**Props**: None (uses stores)

**Usage**:
```svelte
<script>
  import FilterPanel from '$lib/components/FilterPanel.svelte';
</script>

<FilterPanel />
```

**Features**:
- Keyword input (comma-separated)
- Event type checkboxes
- Apply filters button
- Clear all filters button
- Active filter indicator

**Interactions**:
- Type keywords: Filter by text content
- Check/uncheck event types: Show/hide event types
- Click "Apply": Apply filter changes
- Click "Clear All": Remove all filters

**Stores Used**:
- `filtersStore.keywords` - Keyword filters
- `filtersStore.eventTypes` - Event type filters
- `filtersStore.hasActiveFilters` - Filter status

---

### StatsPanel

**Location**: `src/lib/components/StatsPanel.svelte`

Displays real-time statistics.

**Props**: None (uses stores)

**Usage**:
```svelte
<script>
  import StatsPanel from '$lib/components/StatsPanel.svelte';
</script>

<StatsPanel />
```

**Features**:
- Events per minute rate
- Total events delivered
- Events deduplicated
- Total events processed
- Animated number transitions
- Color-coded metrics

**Stores Used**:
- `statsStore.eventsPerMin` - Rate calculation
- `statsStore.total` - Total count
- `statsStore.delivered` - Delivered count
- `statsStore.deduped` - Deduped count

**Styling**:
- Glassmorphism card
- Large numbers with animations
- Color indicators (green for good, yellow for warning)

---

## UI Components

### Header

**Location**: `src/lib/components/Header.svelte`

Application header with branding and controls.

**Props**: None (uses stores)

**Usage**:
```svelte
<script>
  import Header from '$lib/components/Header.svelte';
</script>

<Header />
```

**Features**:
- Logo and title
- Connection status indicator
- Active filter indicator
- Endpoint selector dropdown
- Search button
- Export button

**Interactions**:
- Click logo: Refresh page
- Click status: Show connection details
- Click filter indicator: Open filter panel
- Select endpoint: Change backend connection
- Click search: Open search modal
- Click export: Download events

**Styling**:
- Sticky positioning
- Glassmorphism background
- Smooth transitions

---

### MediaGrid

**Location**: `src/lib/components/MediaGrid.svelte`

Displays images in a responsive grid.

**Props**:
```typescript
interface MediaGridProps {
  images: string[];  // Array of image URLs (1-4 images)
}
```

**Usage**:
```svelte
<script>
  import MediaGrid from '$lib/components/MediaGrid.svelte';
  
  const images = [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg'
  ];
</script>

<MediaGrid {images} />
```

**Features**:
- Responsive grid layout
- Adapts to 1-4 images
- Lazy loading
- Click to open modal
- Error handling for failed loads
- Loading placeholders

**Grid Layouts**:
- 1 image: Full width
- 2 images: 2 columns
- 3 images: 2 columns (first full width)
- 4 images: 2x2 grid

**Styling**:
- Rounded corners
- Hover zoom effect
- Smooth transitions
- Aspect ratio preservation

---

### LoadingSkeleton

**Location**: `src/lib/components/LoadingSkeleton.svelte`

Displays loading placeholder.

**Props**:
```typescript
interface LoadingSkeletonProps {
  type?: 'card' | 'list' | 'text';  // Default: 'card'
  count?: number;                    // Default: 1
}
```

**Usage**:
```svelte
<script>
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte';
</script>

<!-- Single card skeleton -->
<LoadingSkeleton type="card" />

<!-- Multiple list items -->
<LoadingSkeleton type="list" count={5} />

<!-- Text lines -->
<LoadingSkeleton type="text" count={3} />
```

**Features**:
- Animated shimmer effect
- Multiple layout types
- Configurable count
- Matches component dimensions

**Styling**:
- Glassmorphism background
- Smooth pulse effect

---

### KeyboardNavigation

**Location**: `src/lib/components/KeyboardNavigation.svelte`

Provides keyboard shortcut handling.

**Props**: None

**Usage**:
```svelte
<script>
  import KeyboardNavigation from '$lib/components/KeyboardNavigation.svelte';
</script>

<KeyboardNavigation />
```

**Shortcuts**:
- `Ctrl/Cmd + K`: Clear filters
- `Ctrl/Cmd + F`: Focus search
- `Ctrl/Cmd + E`: Export events
- `Escape`: Close modals
- `Arrow Up/Down`: Navigate lists
- `Enter`: Select item

**Features**:
- Global keyboard handling
- Prevents default browser shortcuts
- Accessible keyboard navigation
- Visual focus indicators

---

## Modal Components

### ImageModal

**Location**: `src/lib/components/ImageModal.svelte`

Full-screen image viewer.

**Props**:
```typescript
interface ImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Usage**:
```svelte
<script>
  import ImageModal from '$lib/components/ImageModal.svelte';
  
  let isOpen = $state(false);
  let selectedImage = $state('');
  
  function openImage(url: string) {
    selectedImage = url;
    isOpen = true;
  }
  
  function closeModal() {
    isOpen = false;
  }
</script>

<button onclick={() => openImage('https://example.com/image.jpg')}>
  View Image
</button>

<ImageModal 
  imageUrl={selectedImage}
  {isOpen}
  onClose={closeModal}
/>
```

**Features**:
- Full-screen overlay
- Close button
- ESC key to close
- Click outside to close
- Fade-in animation
- Image zoom controls

**Interactions**:
- Click close button: Close modal
- Press ESC: Close modal
- Click backdrop: Close modal
- Scroll: Zoom in/out (optional)

**Styling**:
- Dark overlay (backdrop)
- Centered image
- Smooth fade animation
- Responsive sizing

---

## Component Composition

### Example: Building a Custom Feed

```svelte
<script lang="ts">
  import EventFeed from '$lib/components/EventFeed.svelte';
  import FilterPanel from '$lib/components/FilterPanel.svelte';
  import StatsPanel from '$lib/components/StatsPanel.svelte';
  import { eventsStore } from '$lib/stores/events.svelte';
  
  // Custom filtering logic
  const customEvents = $derived(() => {
    return eventsStore.filteredEvents.filter(e => 
      e.user.username.includes('crypto')
    );
  });
</script>

<div class="custom-feed">
  <div class="sidebar">
    <FilterPanel />
    <StatsPanel />
  </div>
  
  <div class="main">
    <EventFeed />
  </div>
</div>
```

### Example: Custom Card Component

```svelte
<script lang="ts">
  import type { TwitterEvent } from '$lib/types';
  import TweetCard from '$lib/components/TweetCard.svelte';
  import ProfileCard from '$lib/components/ProfileCard.svelte';
  
  let { event }: { event: TwitterEvent } = $props();
</script>

<div class="custom-card">
  {#if event.type === 'post_created'}
    <TweetCard {event} />
  {:else if event.type === 'profile_updated'}
    <ProfileCard {event} />
  {:else}
    <div>Unknown event type</div>
  {/if}
</div>

<style>
  .custom-card {
    @apply mb-4 transition-all duration-300;
  }
  
  .custom-card:hover {
    @apply scale-105;
  }
</style>
```

---

## Best Practices

### 1. Component Reusability

Keep components generic and reusable:

```svelte
<!-- ✅ Good - Reusable -->
<Card title={title} content={content} />

<!-- ❌ Bad - Too specific -->
<TweetCardForElonMusk />
```

### 2. Props vs Stores

Use props for component-specific data, stores for global state:

```svelte
<!-- ✅ Good -->
<TweetCard event={event} />  <!-- Prop -->
<EventFeed />                <!-- Uses store internally -->

<!-- ❌ Bad -->
<TweetCard />  <!-- Accessing store inside when event should be a prop -->
```

### 3. Event Handling

Use descriptive event handler names:

```svelte
<!-- ✅ Good -->
<button onclick={handleUserClick}>Click</button>

<!-- ❌ Bad -->
<button onclick={click}>Click</button>
```

### 4. Accessibility

Always include ARIA labels and keyboard support:

```svelte
<!-- ✅ Good -->
<button 
  aria-label="Close modal"
  onclick={close}
  onkeydown={(e) => e.key === 'Enter' && close()}
>
  ×
</button>

<!-- ❌ Bad -->
<div onclick={close}>×</div>
```

### 5. Performance

Use virtual scrolling for large lists and lazy loading for images:

```svelte
<!-- ✅ Good -->
<img src={url} loading="lazy" alt="..." />

<!-- ❌ Bad -->
<img src={url} alt="..." />  <!-- Loads immediately -->
```

---

## Testing Components

All components should have corresponding test files. Example:

```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TweetCard from './TweetCard.svelte';

describe('TweetCard', () => {
  const mockEvent = {
    type: 'post_created',
    data: {
      tweet: {
        body: { text: 'Test tweet' },
        author: { handle: 'test', profile: { name: 'Test User' } }
      }
    }
  };
  
  it('renders tweet text', () => {
    render(TweetCard, { props: { event: mockEvent } });
    expect(screen.getByText('Test tweet')).toBeInTheDocument();
  });
  
  it('handles mention click', async () => {
    render(TweetCard, { props: { event: mockEvent } });
    const mention = screen.getByText('@test');
    await fireEvent.click(mention);
    // Assert filter was applied
  });
});
```

---

## Troubleshooting

### Component Not Rendering

1. Check props are passed correctly
2. Verify imports are correct
3. Check for TypeScript errors
4. Inspect browser console for errors

### Styling Issues

1. Check Tailwind classes are correct
2. Verify custom CSS is not conflicting
3. Use browser DevTools to inspect styles
4. Check for CSS specificity issues

### Performance Issues

1. Use virtual scrolling for large lists
2. Implement lazy loading for images
3. Avoid unnecessary re-renders
4. Use `$derived` for computed values

---

## Additional Resources

- [Svelte 5 Component Documentation](https://svelte.dev/docs/svelte/components)
- [SvelteKit Routing](https://kit.svelte.dev/docs/routing)
- [Tailwind CSS Components](https://tailwindcss.com/docs/components)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

For more information, see:
- [STORES.md](./STORES.md) - Store API documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide
- [README.md](../README.md) - Project overview
