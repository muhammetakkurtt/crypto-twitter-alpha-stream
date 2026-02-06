# Crypto Twitter Alpha Stream - Frontend

A modern, high-performance real-time dashboard built with Svelte 5 for monitoring crypto Twitter events. This frontend provides a sleek, responsive interface for viewing tweets, profile updates, and follow events from tracked crypto influencers.

## Features

- **Real-time Event Streaming**: Live updates via Socket.IO with automatic reconnection
- **Advanced Filtering**: Filter by users, keywords, and event types
- **Virtual Scrolling**: Smooth performance with thousands of events
- **Modern UI**: Glassmorphism design with smooth animations and transitions
- **Search & Export**: Full-text search and export to JSON/CSV
- **Keyboard Shortcuts**: Quick access to common actions
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Accessibility**: WCAG 2.1 AA compliant with full keyboard navigation

## Tech Stack

- **Framework**: Svelte 5 with Runes system
- **Build Tool**: Vite + SvelteKit
- **Styling**: Tailwind CSS 4 + Skeleton UI
- **Icons**: Lucide Svelte
- **Real-time**: Socket.IO Client
- **Testing**: Vitest + Testing Library
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend server running (see main project README)

### Installation

```bash
cd frontend
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

Open in browser automatically:

```bash
npm run dev -- --open
```

### Building for Production

Create an optimized production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Analyze bundle size:

```bash
npm run build:analyze
```

## Project Structure

```
frontend/
├── src/
│   ├── lib/
│   │   ├── components/       # Svelte components
│   │   │   ├── EventFeed.svelte
│   │   │   ├── TweetCard.svelte
│   │   │   ├── ProfileCard.svelte
│   │   │   ├── FollowCard.svelte
│   │   │   ├── UserList.svelte
│   │   │   ├── FilterPanel.svelte
│   │   │   ├── StatsPanel.svelte
│   │   │   ├── Header.svelte
│   │   │   ├── MediaGrid.svelte
│   │   │   └── ImageModal.svelte
│   │   ├── stores/           # State management
│   │   │   ├── events.svelte.ts
│   │   │   ├── socket.svelte.ts
│   │   │   ├── filters.svelte.ts
│   │   │   ├── stats.svelte.ts
│   │   │   ├── search.svelte.ts
│   │   │   └── toast.svelte.ts
│   │   ├── types/            # TypeScript types
│   │   │   ├── events.ts
│   │   │   ├── user.ts
│   │   │   ├── filters.ts
│   │   │   └── stats.ts
│   │   ├── utils/            # Utility functions
│   │   │   ├── text.ts
│   │   │   ├── highlight.ts
│   │   │   ├── debounce.ts
│   │   │   ├── throttle.ts
│   │   │   ├── formatTime.ts
│   │   │   ├── export.ts
│   │   │   └── eventNotifications.ts
│   │   └── hooks/            # Custom hooks
│   │       ├── useVirtualScroll.ts
│   │       ├── useLazyLoad.ts
│   │       └── useKeyboard.ts
│   ├── routes/               # SvelteKit routes
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   ├── app.css              # Global styles
│   └── app.html             # HTML template
├── static/                  # Static assets
├── tests/                   # Test files
├── svelte.config.js         # Svelte configuration
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind configuration
└── tsconfig.json            # TypeScript configuration
```

## Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test:watch
```

Generate coverage report:

```bash
npm test:coverage
```

## Code Quality

Check TypeScript types:

```bash
npm run check
```

Watch mode for type checking:

```bash
npm run check:watch
```

Lint code:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Clear all filters
- `Ctrl/Cmd + F` - Focus search
- `Ctrl/Cmd + E` - Export events
- `Escape` - Close modals

## Configuration

### Socket.IO Connection

The Socket.IO connection is configured in `src/lib/stores/socket.svelte.ts`. By default, it connects to the same host as the frontend. To change the backend URL, modify the connection settings:

```typescript
this.socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  // ... other options
});
```

### Vite Proxy

For development, the Vite dev server proxies Socket.IO requests to the backend. Configure this in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/socket.io': {
      target: 'http://localhost:3000',
      ws: true
    }
  }
}
```

## Troubleshooting

### Socket.IO Connection Issues

If the dashboard shows "Disconnected":

1. Ensure the backend server is running
2. Check the browser console for connection errors
3. Verify the Socket.IO endpoint in the proxy configuration
4. Check for CORS issues in the backend

### Build Errors

If you encounter build errors:

1. Clear the `.svelte-kit` directory: `rm -rf .svelte-kit`
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Check for TypeScript errors: `npm run check`

### Performance Issues

If the dashboard feels slow:

1. Check the number of events in the feed (virtual scrolling activates at 100+)
2. Clear old events using the clear button
3. Apply filters to reduce the number of displayed events
4. Check browser DevTools Performance tab for bottlenecks

## Contributing

When contributing to the frontend:

1. Follow the existing code style (enforced by ESLint/Prettier)
2. Write tests for new components and utilities
3. Ensure all tests pass before submitting
4. Update documentation for new features
5. Keep bundle size minimal

## License

See the main project LICENSE file.
