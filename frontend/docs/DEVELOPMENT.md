# Development Guide

This guide covers everything you need to know to develop and contribute to the Crypto Twitter Alpha Stream frontend.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Component Development](#component-development)
- [State Management](#state-management)
- [Styling Guidelines](#styling-guidelines)
- [Testing](#testing)
- [Performance Optimization](#performance-optimization)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)

---

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 9 or higher
- Basic knowledge of Svelte 5 and TypeScript
- Familiarity with Tailwind CSS

### Initial Setup

1. Clone the repository and navigate to the frontend directory:
```bash
cd crypto-twitter-alpha-stream/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Development Environment

We recommend using VS Code with the following extensions:

- **Svelte for VS Code** - Syntax highlighting and IntelliSense
- **Tailwind CSS IntelliSense** - Tailwind class autocomplete
- **ESLint** - Code linting
- **Prettier** - Code formatting

---

## Project Architecture

### Directory Structure

```
src/
├── lib/
│   ├── components/       # Reusable Svelte components
│   ├── stores/           # State management with Svelte 5 Runes
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── hooks/            # Custom hooks
│   └── test-utils.ts     # Testing utilities
├── routes/               # SvelteKit routes
│   ├── +layout.svelte    # Root layout
│   └── +page.svelte      # Main page
├── app.css              # Global styles
└── app.html             # HTML template
```

### Key Concepts

#### Svelte 5 Runes

This project uses Svelte 5's new Runes system for reactivity:

- `$state` - Reactive state
- `$derived` - Computed values
- `$effect` - Side effects
- `$props` - Component props

Example:
```typescript
let count = $state(0);
let doubled = $derived(count * 2);

$effect(() => {
  console.log(`Count is ${count}`);
});
```

#### Component Architecture

Components follow a clear hierarchy:

1. **Page Components** (`routes/+page.svelte`) - Top-level pages
2. **Layout Components** (`MainLayout.svelte`) - Page structure
3. **Feature Components** (`EventFeed.svelte`, `UserList.svelte`) - Major features
4. **UI Components** (`TweetCard.svelte`, `Header.svelte`) - Reusable UI elements

#### State Management

State is organized into logical stores:

- **events** - Event data
- **socket** - WebSocket connection
- **filters** - Filter criteria
- **stats** - Statistics
- **search** - Search functionality
- **toast** - Notifications

See [STORES.md](./STORES.md) for detailed API documentation.

---

## Development Workflow

### 1. Create a New Feature

```bash
# Create a new branch
git checkout -b feature/my-feature

# Make your changes
# ...

# Run tests
npm test

# Check types
npm run check

# Lint and format
npm run lint
npm run format

# Commit and push
git add .
git commit -m "Add my feature"
git push origin feature/my-feature
```

### 2. Hot Module Replacement (HMR)

Vite provides instant HMR. Changes to `.svelte` files will update in the browser without a full reload.

### 3. Type Checking

Run TypeScript type checking:

```bash
npm run check
```

Watch mode for continuous type checking:

```bash
npm run check:watch
```

### 4. Code Quality

Before committing, ensure your code passes all checks:

```bash
npm run lint      # Check for linting errors
npm run format    # Format code
npm test          # Run tests
npm run check     # Type check
```

---

## Component Development

### Creating a New Component

1. Create the component file in `src/lib/components/`:

```svelte
<!-- MyComponent.svelte -->
<script lang="ts">
  import type { MyProps } from '$lib/types';
  
  let { title, items }: MyProps = $props();
  
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  function handleClick() {
    count++;
  }
</script>

<div class="my-component">
  <h2>{title}</h2>
  <p>Count: {count}, Doubled: {doubled}</p>
  <button onclick={handleClick}>Increment</button>
  
  {#each items as item}
    <div>{item}</div>
  {/each}
</div>

<style>
  .my-component {
    @apply p-4 rounded-lg bg-slate-800;
  }
</style>
```

2. Create a test file `MyComponent.test.ts`:

```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  it('renders title', () => {
    render(MyComponent, { 
      props: { title: 'Test', items: [] } 
    });
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  it('increments count on click', async () => {
    render(MyComponent, { 
      props: { title: 'Test', items: [] } 
    });
    
    const button = screen.getByText('Increment');
    await fireEvent.click(button);
    
    expect(screen.getByText(/Count: 1/)).toBeInTheDocument();
  });
});
```

3. Export types in `src/lib/types/index.ts`:

```typescript
export interface MyProps {
  title: string;
  items: string[];
}
```

### Component Best Practices

#### 1. Use TypeScript

Always type your props and state:

```typescript
let { event }: { event: TwitterEvent } = $props();
let isOpen = $state<boolean>(false);
```

#### 2. Keep Components Small

Each component should have a single responsibility. If a component grows too large, split it into smaller components.

#### 3. Use Derived State

Prefer `$derived` over recalculating values:

```typescript
// ✅ Good
let fullName = $derived(`${firstName} ${lastName}`);

// ❌ Bad
function getFullName() {
  return `${firstName} ${lastName}`;
}
```

#### 4. Avoid Side Effects in Render

Use `$effect` for side effects:

```typescript
// ✅ Good
$effect(() => {
  console.log('Count changed:', count);
});

// ❌ Bad
{console.log('Count changed:', count)}
```

#### 5. Use Semantic HTML

Always use appropriate HTML elements:

```svelte
<!-- ✅ Good -->
<button onclick={handleClick}>Click me</button>

<!-- ❌ Bad -->
<div onclick={handleClick}>Click me</div>
```

---

## State Management

### Creating a New Store

1. Create the store file in `src/lib/stores/`:

```typescript
// myStore.svelte.ts
class MyStore {
  data = $state<string[]>([]);
  
  // Derived state
  count = $derived(this.data.length);
  
  add(item: string) {
    this.data = [...this.data, item];
  }
  
  clear() {
    this.data = [];
  }
}

export const myStore = new MyStore();
```

2. Use the store in components:

```svelte
<script lang="ts">
  import { myStore } from '$lib/stores/myStore.svelte';
  
  const data = $derived(myStore.data);
  const count = $derived(myStore.count);
</script>

<div>
  <p>Count: {count}</p>
  <button onclick={() => myStore.add('item')}>Add</button>
</div>
```

### Store Best Practices

1. **Keep stores focused** - Each store should manage a specific domain
2. **Use derived state** - Compute values in the store, not in components
3. **Immutable updates** - Always create new arrays/objects instead of mutating
4. **Type everything** - Use TypeScript for all store data

---

## Styling Guidelines

### Tailwind CSS

We use Tailwind CSS 4 for styling. Always prefer Tailwind classes over custom CSS.

#### Common Patterns

```svelte
<!-- Card with glassmorphism -->
<div class="rounded-lg bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-6">
  Content
</div>

<!-- Button with hover effect -->
<button class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors">
  Click me
</button>

<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Items -->
</div>
```

#### Custom Utilities

Custom utilities are defined in `app.css`:

```css
.glass {
  @apply bg-slate-900/80 backdrop-blur-sm border border-slate-700/50;
}

.glow-blue {
  @apply shadow-lg shadow-blue-500/20;
}
```

### Animations

Use Tailwind's transition utilities:

```svelte
<div class="transition-all duration-300 hover:scale-105">
  Hover me
</div>
```

For complex animations, use Svelte transitions:

```svelte
<script>
  import { fade, fly } from 'svelte/transition';
</script>

<div transition:fly={{ y: -20, duration: 300 }}>
  Animated content
</div>
```

---

## Testing

### Unit Tests

Test individual functions and components:

```typescript
import { describe, it, expect } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
  it('formats timestamp correctly', () => {
    const result = formatTime(1234567890000);
    expect(result).toBe('Feb 13, 2009');
  });
});
```

### Component Tests

Test component behavior:

```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TweetCard from './TweetCard.svelte';

describe('TweetCard', () => {
  it('renders tweet text', () => {
    const event = {
      type: 'post_created',
      data: {
        tweet: {
          body: { text: 'Hello world' },
          author: { handle: 'test', profile: { name: 'Test' } }
        }
      }
    };
    
    render(TweetCard, { props: { event } });
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });
});
```

### Integration Tests

Test multiple components working together:

```typescript
import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { eventsStore } from '$lib/stores/events.svelte';
import EventFeed from './EventFeed.svelte';

describe('EventFeed Integration', () => {
  it('displays events from store', async () => {
    eventsStore.addEvent(mockEvent);
    
    render(EventFeed);
    
    await waitFor(() => {
      expect(screen.getByText('Test tweet')).toBeInTheDocument();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage

# Run specific test file
npm test -- TweetCard.test.ts
```

---

## Performance Optimization

### Virtual Scrolling

For large lists, use virtual scrolling:

```typescript
const ITEM_HEIGHT = 200;
const BUFFER = 5;

let scrollTop = $state(0);

const visibleRange = $derived(() => {
  const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
  const end = Math.min(
    items.length,
    Math.ceil((scrollTop + window.innerHeight) / ITEM_HEIGHT) + BUFFER
  );
  return { start, end };
});

const visibleItems = $derived(() => {
  return items.slice(visibleRange.start, visibleRange.end);
});
```

### Lazy Loading

Use the `loading="lazy"` attribute for images:

```svelte
<img src={imageUrl} loading="lazy" alt="..." />
```

### Debouncing

Debounce expensive operations:

```typescript
import { debounce } from '$lib/utils/debounce';

const debouncedSearch = debounce((query: string) => {
  // Expensive search operation
}, 300);
```

### Bundle Size

Monitor bundle size:

```bash
npm run build:analyze
```

Keep the bundle under 10KB gzipped (excluding dependencies).

---

## Debugging

### Browser DevTools

Use the Svelte DevTools extension for Chrome/Firefox to inspect component state.

### Console Logging

Add temporary logging:

```typescript
$effect(() => {
  console.log('State changed:', myState);
});
```

### Type Errors

Check for type errors:

```bash
npm run check
```

### Network Issues

Check the Network tab in DevTools for Socket.IO connection issues.

### Performance Issues

Use the Performance tab in DevTools to identify bottlenecks.

---

## Common Tasks

### Adding a New Event Type

1. Add the type to `src/lib/types/events.ts`:

```typescript
export type EventType = 
  | 'post_created'
  | 'my_new_type';  // Add here
```

2. Update the filters store to include it:

```typescript
eventTypes = $state<string[]>([
  'post_created',
  'my_new_type',  // Add here
]);
```

3. Create a card component for the new type:

```svelte
<!-- MyNewTypeCard.svelte -->
<script lang="ts">
  let { event }: { event: TwitterEvent } = $props();
</script>

<div class="card">
  <!-- Render your event type -->
</div>
```

4. Add it to the EventFeed routing:

```svelte
{#if event.type === 'my_new_type'}
  <MyNewTypeCard {event} />
{/if}
```

### Adding a New Filter

1. Add state to the filters store:

```typescript
class FilterStore {
  myNewFilter = $state<string>('');
  
  setMyNewFilter(value: string) {
    this.myNewFilter = value;
  }
}
```

2. Update the `shouldDisplayEvent` method:

```typescript
shouldDisplayEvent(event: TwitterEvent): boolean {
  // ... existing checks
  
  if (this.myNewFilter && !event.data.matches(this.myNewFilter)) {
    return false;
  }
  
  return true;
}
```

3. Add UI in FilterPanel:

```svelte
<input 
  type="text"
  bind:value={myNewFilter}
  placeholder="My new filter..."
/>
```

### Adding a Keyboard Shortcut

1. Update the keyboard hook:

```typescript
// src/lib/hooks/useKeyboard.ts
export function useKeyboard() {
  $effect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'n') {  // Ctrl+N
        e.preventDefault();
        // Handle your shortcut
      }
    }
    
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
}
```

2. Document it in the README and UI.

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all dependencies
npm update

# Update a specific package
npm install package-name@latest

# Test after updating
npm test
npm run check
npm run build
```

---

## Troubleshooting

### "Module not found" errors

Clear the SvelteKit cache:

```bash
rm -rf .svelte-kit
npm run dev
```

### Type errors after updating Svelte

Regenerate types:

```bash
npm run prepare
```

### Tests failing after changes

Clear test cache:

```bash
npm test -- --clearCache
```

### Build fails

1. Check for TypeScript errors: `npm run check`
2. Check for linting errors: `npm run lint`
3. Clear build cache: `rm -rf build .svelte-kit`

---

## Resources

- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/docs/svelte-testing-library/intro)

---

## Getting Help

If you encounter issues:

1. Check this guide and the README
2. Search existing GitHub issues
3. Ask in the project Discord/Slack
4. Create a new GitHub issue with details

