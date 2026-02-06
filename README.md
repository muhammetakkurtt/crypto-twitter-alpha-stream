# Crypto Twitter Alpha Stream

<div align="center">

![Dashboard Demo](https://github.com/muhammetakkurtt/crypto-twitter-alpha-stream/releases/download/v1.0.0/dashboard-demo.gif)

</div>

Real-time Twitter event streaming application that consumes Server-Sent Events (SSE) from an [Apify actor](https://apify.com/muhammetakkurtt/crypto-twitter-tracker?fpr=muh) and distributes filtered, deduplicated Twitter events to multiple output channels. Monitor curated crypto Twitter accounts with live CLI streams, interactive web dashboards, and instant alerts.

## Features

- **🔴 Real-time SSE streaming** from Apify actor endpoints with automatic reconnection
- **📺 Multiple output channels**: CLI live stream, Web Dashboard, and Alerts (Telegram/Discord/Webhook)
- **🔍 Smart filtering** by users, keywords, and event types
- **🚫 Deduplication** to prevent redundant notifications
- **🔄 Automatic reconnection** with exponential backoff for resilience
- **🎨 Interactive web dashboard** for visual monitoring and real-time filtering
- **📊 Health monitoring** via HTTP status endpoint
- **⚡ Fast setup** - Get streaming in 5-10 minutes

## Table of Contents

- [Quick Start](#quick-start)
- [Cost Optimization](#cost-optimization)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [API Endpoints](#api-endpoints)
- [Output Channels](#output-channels)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Project Structure](#project-structure)
- [License](#license)

## Quick Start

Get up and running in under 10 minutes:

### Prerequisites

- Node.js 18+ and npm
- An Apify account with API token ([Get one here](https://console.apify.com/settings/integrations?fpr=muh))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypto-twitter-alpha-stream
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

4. **Add your Apify token**
   
   Edit `.env` and set your token:
   ```env
   APIFY_TOKEN=your_apify_token_here
   ```

5. **Start streaming!**
   ```bash
   npm run dev
   ```

That's it! You should now see live Twitter events streaming in your terminal.

### Docker Quick Start

Prefer Docker? Run with docker-compose:

```bash
# Create .env file with your token
echo "APIFY_TOKEN=your_token_here" > .env

# Start the application
docker-compose up
```

Access the dashboard at `http://localhost:3000`

## Cost Optimization

### Understanding Actor Charging

The Apify actor uses a per-client charging model, meaning each connected client is charged separately based on the events delivered to that client.

**Without User Filtering**:
- The actor monitors multiple Twitter accounts
- Without filters, your client receives events from all monitored accounts
- You are charged for every event delivered to your client

**With User Filtering**:
- Configure the `USERS` environment variable with specific usernames
- The actor filters events at the source (actor-side filtering)
- Only events from your specified users are delivered to your client
- You are only charged for events actually delivered
- This can significantly reduce the number of events you receive and pay for

### Cost Comparison Examples

**Example 1: No Filter**
```bash
USERS=
# Result: Receives events from all monitored accounts
```

**Example 2: Filter 3 Users**
```bash
USERS=elonmusk,vitalikbuterin,cz_binance
# Result: Receives ONLY these 3 accounts' events
# You are charged only for events from these 3 accounts
```

**Example 3: Filter 10 Users**
```bash
USERS=elonmusk,vitalikbuterin,cz_binance,SBF_FTX,justinsuntron,aantonop,APompliano,naval,balajis,VitalikButerin
# Result: Receives ONLY these 10 accounts' events
# You are charged only for events from these 10 accounts
```

### How to Configure User Filtering

Follow these steps to optimize costs with user filtering:

**Step 1: Check the Monitored Users List**

Before configuring filters, check which accounts are returned by the actor's monitored users endpoint:

```bash
curl -H "Authorization: Bearer YOUR_APIFY_TOKEN" \
     https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
```

This returns a JSON array of monitored usernames:
```json
["elonmusk", "vitalikbuterin", "cz_binance", "SBF_FTX", ...]
```

**Note**: The actor may monitor additional users beyond this list. This endpoint returns a subset for reference.

**Step 2: Configure Your User Filter**

Add the usernames you want to monitor to your `.env` file:

```env
USERS=elonmusk,vitalikbuterin,cz_binance
```

**Format Rules**:
- Comma-separated, no spaces
- Case-insensitive
- No @ symbol
- Can include usernames not in the returned list (actor may still monitor them)

**Step 3: Start the Application**

```bash
npm start
```

The application will:
1. Validate your configured usernames against the active users list
2. Warn you if any usernames are invalid (not in the monitored list)
3. Connect to the actor with the `?users=` parameter
4. Receive only events from your specified users

### Important Notes About User Filtering

⚠️ **Monitored users list is informational**: The `/active-users` endpoint returns a list of monitored users, but the actor may monitor additional users. If you configure a username not in the returned list, you may still receive events if the actor monitors that user.

⚠️ **Validation warnings are advisory**: The application validates filters on startup and warns about usernames not in the returned list. These warnings are informational - the actor may still monitor those users.

✅ **Actor-side filtering**: By filtering at the source, you only receive events from your specified users. This reduces the number of events delivered to your client.

✅ **Client-side filtering still works**: You can still use `KEYWORDS` to further filter events after they're received. This provides additional refinement.

✅ **Two-layer filtering system**: The application uses both actor-side filtering (by users) and client-side filtering (by keywords, event types):
- Layer 1 (Actor-side): Filters by users at the source
- Layer 2 (Client-side): Filters by keywords, event types

### Validation Warnings

When you start the application with user filters, it validates your configuration:

**Valid Configuration**:
```
✓ All configured users are in the returned monitored users list
✓ Connecting with user filters: elonmusk, vitalikbuterin
```

**Advisory Warning**:
```
⚠️  WARNING: User filter validation notice!

The following usernames are NOT in the returned monitored users list:
  someuser, anotheruser

Note: The actor may monitor additional users beyond this list.
If these users are monitored by the actor, you WILL receive their events.

Valid configured users (confirmed in list):
  elonmusk, vitalikbuterin

Sample of returned monitored users:
  elonmusk, vitalikbuterin, cz_binance, SBF_FTX, ...

To see the full list of monitored users, visit:
  /active-users endpoint
```

The application will still proceed with the connection, but you'll only receive events for valid usernames.

## Configuration

The application supports three configuration methods with the following priority:

1. **Environment variables** (highest priority)
2. **config/config.json** file
3. **Default values** (lowest priority)

### Essential Configuration

The required configuration includes your Apify token and the actor URL:

```env
APIFY_TOKEN=your_apify_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
```

### Common Configuration Options

```env
# Apify actor URL (already set to the deployed actor)
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor

# Select endpoint (all, tweets, following, profile)
ENDPOINT=all

# Filter by specific users (comma-separated)
USERS=elonmusk,vitalikbuterin,cz_binance

# Filter by keywords (comma-separated, case-insensitive)
KEYWORDS=bitcoin,ethereum,defi

# Debug mode (enables detailed logging throughout event processing pipeline)
# Set to 'true' to enable verbose logging for troubleshooting
# WARNING: Debug mode is very verbose and may impact performance
DEBUG=false

# Enable/disable web dashboard
# Default: false (disabled), set to true to enable
DASHBOARD_ENABLED=false
DASHBOARD_PORT=3000

# Telegram alerts
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Discord alerts
DISCORD_ENABLED=false
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Generic webhook
WEBHOOK_ENABLED=false
WEBHOOK_URL=https://your-webhook-url.com/endpoint
```

For complete configuration options, see:
- [`.env.example`](.env.example) - All environment variables with descriptions
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) - Detailed configuration guide
- [`config/config.example.json`](config/config.example.json) - JSON configuration example

## Usage Examples

### Example 1: CLI Live Stream (Default)

Monitor all events in your terminal:

```bash
npm run dev
```

Output:
```
[post_created] @elonmusk: Bitcoin is the future of money...
[profile_update] @vitalikbuterin: changed bio
[following] @cz_binance: followed @SBF_FTX

--- Stats (60s) ---
events_total=120  delivered=95  deduped=25  rate=2.0/s
```

### Example 2: Web Dashboard

Enable the dashboard to get a visual interface:

```env
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000
```

```bash
npm run dev
```

Open `http://localhost:3000` in your browser to:
- View live event feed with auto-scroll
- Filter events by keywords and event types
- Search active users
- Switch between endpoints
- Monitor connection status and statistics

### Example 3: Telegram Alerts

Get instant notifications on Telegram with rich formatting:

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Configure:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
ALERT_RATE_LIMIT=30
```

You'll receive rich formatted alerts with:
- **Photos displayed prominently** for tweets with images
- **Clickable username links** to Twitter profiles
- **Inline buttons** for "View Tweet" and "View Profile"
- **HTML formatting** with bold text and emojis
- **Media indicators** for multiple images/videos

Example message:
```
📝 New Tweet
👤 @elonmusk

Bitcoin is the future of money and will replace all fiat currencies...

🖼️ 2 images
🎥 1 video(s)

🕐 2024-01-15 14:30:22 UTC

[🔗 View Tweet] [👤 View Profile]
```

### Example 4: Filter Specific Users and Keywords

Monitor only specific accounts for certain keywords:

```env
ENDPOINT=tweets
USERS=elonmusk,vitalikbuterin,cz_binance
KEYWORDS=bitcoin,ethereum,btc,eth
```

This will only show tweets from these three users that mention crypto keywords.

### Example 5: Discord Webhook Integration

Send rich embeds to a Discord channel:

1. Create a webhook in your Discord server settings
2. Configure:

```env
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdefg
ALERT_RATE_LIMIT=30
```

Discord embeds include:
- **Rich embed cards** with Discord's official color palette
- **User avatars** as thumbnails
- **Large image display** for tweet photos
- **Clickable links** to view tweets on Twitter
- **Event-specific colors** (Blue for new tweets, Green for follows, etc.)
- **Media indicators** for multiple images
- **Video notifications** with links to view on Twitter

Example embed features:
- Event emoji + label + username in author section
- Tweet text in description (truncated if long)
- First image displayed prominently
- "View Tweet" and media count fields
- Footer with branding and timestamp

### Example 6: Multiple Outputs Simultaneously

Run all outputs at once:

```env
CLI_ENABLED=true
DASHBOARD_ENABLED=true
TELEGRAM_ENABLED=true
DISCORD_ENABLED=true
```

Events will be broadcast to all enabled channels independently.

## API Endpoints

### Health Status Endpoint

**GET** `/status`

Returns application health and statistics.

**Port**: `3001` (configurable via `HEALTH_PORT`)

**Response**:
```json
{
  "connection": {
    "status": "connected",
    "endpoint": "/events/twitter/all",
    "uptime": 3600
  },
  "events": {
    "total": 1250,
    "delivered": 980,
    "deduped": 270,
    "rate": 2.5
  },
  "alerts": {
    "telegram": { "sent": 45, "failed": 2 },
    "discord": { "sent": 45, "failed": 0 },
    "webhook": { "sent": 0, "failed": 0 }
  },
  "filters": {
    "users": ["elonmusk", "vitalikbuterin"],
    "keywords": ["bitcoin", "ethereum"]
  }
}
```

**Example**:
```bash
curl http://localhost:3001/status
```

### Dashboard WebSocket

**WebSocket** connection for real-time event streaming to the dashboard.

**Port**: `3000` (configurable via `DASHBOARD_PORT`)

**Events**:
- `event` - New Twitter event
- `connection-status` - Connection status change
- `activeUsers` - Active users list update

See [`docs/API.md`](docs/API.md) for detailed API documentation.

## Output Channels

### CLI Output

Terminal-based live stream with periodic statistics.

**Features**:
- Single-line event formatting
- Periodic statistics display
- Real-time event rate

**Configuration**:
```env
CLI_ENABLED=true
CLI_STATS_INTERVAL=60000  # Display stats every 60 seconds
```

### Web Dashboard

Interactive web interface for visual monitoring.

**Features**:
- Live event feed with auto-scroll
- Active users list with search
- Client-side keyword and event type filters
- Connection status indicator
- Real-time statistics

**Access**: `http://localhost:3000` (default)

**Configuration**:
```env
DASHBOARD_ENABLED=false  # Default: false, set to true to enable
DASHBOARD_PORT=3000
```

### Alert Channels

Push notifications to external services.

**Telegram**:
```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
ALERT_RATE_LIMIT=30
```

**Features**:
- Rich HTML formatting with bold text and emojis
- Photos displayed prominently for tweets with images
- Inline keyboard buttons for "View Tweet" and "View Profile"
- Clickable username links to Twitter profiles
- Media indicators for multiple images/videos
- Full timestamp precision

**Discord**:
```env
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
ALERT_RATE_LIMIT=30
```

**Features**:
- Rich embed cards with Discord's official color palette
- User avatars as thumbnails
- Large image display for tweet photos
- Event-specific colors (Blue for tweets, Green for follows, etc.)
- Clickable links to view tweets on Twitter
- Media indicators for multiple images
- Video notifications with links (Discord doesn't support embedded video playback)

**Generic Webhook**:
```env
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://your-webhook-url.com/endpoint
ALERT_RATE_LIMIT=30
```

**Rate Limiting**: All alert channels support configurable rate limiting via `ALERT_RATE_LIMIT` (default: 10 messages per minute). For high-volume crypto streams, consider setting this to 30 or higher.

## Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to SSE endpoint"

**Solutions**:
- Verify your `APIFY_TOKEN` is correct
- Check your internet connection
- Ensure the Apify actor is running at https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
- Check the actor's health endpoint: `curl -H "Authorization: Bearer YOUR_TOKEN" https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/health`

**Problem**: "Authentication failed"

**Solutions**:
- Verify your token is set correctly in `.env`
- Ensure no extra spaces or quotes around the token
- Generate a new token from [Apify Console](https://console.apify.com/settings/integrations?fpr=muh)

### No Events Appearing

**Problem**: Application runs but no events show up

**Solutions**:
- Check if filters are too restrictive (try removing `USERS` and `KEYWORDS`)
- If using `USERS` filter, verify usernames are in the active users list:
  ```bash
  curl -H "Authorization: Bearer YOUR_TOKEN" \
       https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
  ```
- Check validation warnings on startup for invalid usernames
- Verify the selected endpoint has active events
- Check if tracked accounts are actually posting
- Review the active users list: `curl http://localhost:3001/status`

**Problem**: Configured user filters but receiving no events

**Solutions**:
- Check startup logs for validation warnings about invalid usernames
- Verify your usernames match those in the active users list (case-insensitive)
- Ensure usernames don't include the @ symbol
- Try with a well-known account like `elonmusk` to test
- Check that the actor is actually monitoring those accounts

### Dashboard Not Loading

**Problem**: Cannot access dashboard at `http://localhost:3000`

**Solutions**:
- Verify `DASHBOARD_ENABLED=true` in your `.env`
- Check if port 3000 is already in use (change `DASHBOARD_PORT`)
- Check application logs for errors
- Try accessing `http://127.0.0.1:3000` instead

### Alert Delivery Issues

**Problem**: Telegram/Discord alerts not arriving

**Solutions**:
- **Telegram**: Verify bot token and chat ID are correct
- **Discord**: Test webhook URL with curl:
  ```bash
  curl -X POST -H "Content-Type: application/json" \
    -d '{"content":"Test message"}' \
    YOUR_WEBHOOK_URL
  ```
- Check rate limiting (max 10 alerts per minute)
- Review error logs for failed delivery attempts

### High Memory Usage

**Problem**: Application consuming too much memory

**Solutions**:
- Reduce `DEDUP_TTL` to expire cache entries faster
- Disable unused output channels
- Limit event buffer size in dashboard
- Restart the application periodically

### Duplicate Events

**Problem**: Receiving duplicate events

**Solutions**:
- Verify deduplication is enabled (it's on by default)
- Increase `DEDUP_TTL` (default: 60 seconds)
- Check if multiple instances are running
- Review logs for dedup cache statistics

### Build or Test Failures

**Problem**: `npm test` or `npm run build` fails

**Solutions**:
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear TypeScript cache: `rm -rf dist`
- Ensure Node.js version is 18+: `node --version`
- Check for TypeScript errors: `npx tsc --noEmit`

### Debug Mode

Enable debug mode for comprehensive logging throughout the event processing pipeline. This is essential for troubleshooting data transformation issues, validation failures, and understanding how events flow through the system.

**Enable Debug Mode**:

```bash
# Enable debug logging
DEBUG=true npm start

# Or in development mode
DEBUG=true npm run dev

# Or set in .env file
DEBUG=true
```

**What Debug Mode Logs**:

Debug mode provides detailed visibility into the event processing pipeline:

1. **Raw Actor Events** (SSEClient):
   - Complete event structure as received from the actor
   - Logged before any transformation occurs
   - Helps verify what data is actually being sent

2. **Transformed Events** (SSEClient):
   - Event structure after transformation to internal format
   - Shows extracted username, displayName, userId, primaryId
   - Verifies data preservation during transformation

3. **Validation Failures** (StreamCore):
   - Detailed reasons why events fail validation
   - Shows which required fields are missing
   - Displays the problematic event structure

4. **Event Structure Details**:
   - Complete nested object structures
   - Field-by-field breakdown of event data
   - Helps identify missing or malformed data

5. **Transformation Errors**:
   - Full error context when transformation fails
   - Stack traces for debugging
   - Problematic data that caused the error

**Example Debug Output**:

```
[SSEClient] Raw actor event: {
  "data": {
    "username": "elonmusk",
    "action": "post_created",
    "tweetId": "123456789",
    "tweet": {
      "body": { "text": "Hello world" },
      "author": { "handle": "elonmusk", "id": "44196397" }
    }
  },
  "event_type": "post_created"
}

[SSEClient] Transformed event: {
  "type": "post_created",
  "timestamp": "2024-01-15T14:30:22.000Z",
  "primaryId": "123456789",
  "user": {
    "username": "elonmusk",
    "displayName": "Elon Musk",
    "userId": "44196397"
  },
  "data": { ... }
}

[StreamCore] Event validated successfully
```

**When to Use Debug Mode**:

- **Missing Event Data**: When CLI output doesn't show expected information
- **Validation Failures**: When events are being rejected unexpectedly
- **Transformation Issues**: When data appears corrupted or incomplete
- **Integration Debugging**: When connecting to a new actor or endpoint
- **Development**: When implementing new features or fixing bugs

**Performance Impact**:

⚠️ **Warning**: Debug mode is very verbose and logs large JSON structures. This can:
- Significantly increase log file sizes
- Impact application performance
- Slow down event processing
- Consume more memory

**Best Practices**:

✅ **Enable temporarily** for troubleshooting specific issues
✅ **Disable in production** unless actively debugging
✅ **Use with filters** to reduce log volume (e.g., `USERS=elonmusk`)
✅ **Redirect to file** for analysis: `DEBUG=true npm start > debug.log 2>&1`

**Troubleshooting with Debug Mode**:

1. **Problem**: Events not appearing in CLI
   ```bash
   DEBUG=true npm start
   # Check if raw actor events are being received
   # Check if transformation is working correctly
   # Check if validation is passing
   ```

2. **Problem**: Missing tweet text or user information
   ```bash
   DEBUG=true npm start
   # Compare raw actor event structure with transformed event
   # Verify nested fields are being preserved
   # Check extraction logic is accessing correct paths
   ```

3. **Problem**: Events being rejected
   ```bash
   DEBUG=true npm start
   # Look for validation failure messages
   # Check which required fields are missing
   # Verify event structure matches expected format
   ```

**Disabling Debug Mode**:

```bash
# Remove from command line
npm start

# Or set in .env file
DEBUG=false

# Or remove the DEBUG variable entirely
```

**Note**: Debug logging is controlled by the `DEBUG` environment variable. Set it to `'true'` (string) to enable, or `'false'`/unset to disable.

### Getting Help

If you're still experiencing issues:

1. Check the logs for detailed error messages
2. Enable debug mode with `DEBUG=true` for detailed diagnostics
3. Review the [Configuration Guide](docs/CONFIGURATION.md)
4. Check the [API Documentation](docs/API.md)
5. Open an issue on GitHub with:
   - Error messages
   - Configuration (sanitize tokens!)
   - Steps to reproduce

## Development

### Backend Development

```bash
# Development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Frontend Development

The dashboard is built with Svelte 5 and requires separate build steps:

```bash
# Navigate to frontend directory
cd frontend

# Install frontend dependencies
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run frontend tests
npm test

# Type checking
npm run check
```

The production build output (`frontend/build/`) is automatically served by the backend's DashboardOutput.

For detailed frontend documentation, see:
- [frontend/README.md](frontend/README.md) - Frontend overview
- [frontend/docs/DEVELOPMENT.md](frontend/docs/DEVELOPMENT.md) - Development guide
- [frontend/docs/COMPONENTS.md](frontend/docs/COMPONENTS.md) - Component documentation
- [frontend/docs/STORES.md](frontend/docs/STORES.md) - Store documentation

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- SSEClient.test.ts
```

The test suite includes:
- **Unit tests**: Specific examples and edge cases
- **Integration tests**: Component interactions
- **Property-based tests**: Universal correctness properties (100+ iterations)

### Code Structure

```
crypto-twitter-alpha-stream/
├── src/                      # Backend TypeScript source
│   ├── index.ts              # Application entry point
│   ├── Application.ts        # Main application orchestrator
│   ├── config/               # Configuration management
│   │   ├── ConfigManager.ts  # Config loader with priority resolution
│   │   └── types.ts          # Configuration type definitions
│   ├── sse/                  # SSE client with reconnection
│   │   └── SSEClient.ts      # EventSource wrapper with exponential backoff
│   ├── filters/              # Event filtering pipeline
│   │   ├── FilterPipeline.ts # Filter chain orchestrator
│   │   └── EventFilter.ts    # User and keyword filters
│   ├── streamcore/           # Core event processing
│   │   └── StreamCore.ts     # Event validation and distribution
│   ├── outputs/              # Output channels
│   │   ├── CLIOutput.ts      # Terminal output with stats
│   │   ├── DashboardOutput.ts # WebSocket server for dashboard
│   │   ├── AlertOutput.ts    # Alert orchestrator
│   │   ├── AlertChannel.ts   # Telegram, Discord, Webhook channels
│   │   └── RateLimiter.ts    # Rate limiting for alerts
│   ├── activeusers/          # Active users fetcher
│   │   └── ActiveUsersFetcher.ts # Periodic user list refresh
│   ├── health/               # Health monitoring
│   │   └── HealthMonitor.ts  # HTTP status endpoint
│   ├── models/               # Data models and types
│   │   └── types.ts          # Event types and interfaces
│   ├── utils/                # Utility functions
│   │   └── LogSanitizer.ts   # Sensitive data sanitization
│   ├── validation/           # Input validation
│   │   └── UserFilterValidator.ts # User filter validation
│   ├── dedup/                # Deduplication
│   │   └── DedupCache.ts     # TTL-based event cache
│   └── eventbus/             # Event bus
│       └── EventBus.ts       # Pub/sub for internal events
├── frontend/                 # Dashboard frontend (Svelte 5)
│   ├── src/
│   │   ├── lib/              # Reusable components and stores
│   │   │   ├── components/   # Svelte 5 components
│   │   │   ├── stores/       # Svelte 5 runes-based stores
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── utils/        # Frontend utilities
│   │   │   └── types/        # TypeScript types
│   │   ├── routes/           # SvelteKit routes
│   │   └── app.css           # Global styles (Tailwind)
│   ├── build/                # Production build (served by backend)
│   ├── static/               # Static assets
│   ├── tests/                # Frontend tests (Vitest)
│   └── vite.config.ts        # Vite configuration
├── tests/                    # Backend tests (Jest)
│   ├── unit tests            # Specific examples and edge cases
│   ├── integration tests     # Component interactions
│   └── property tests        # Property-based tests (fast-check)
├── config/                   # Configuration files
├── docs/                     # Documentation
└── dist/                     # Compiled backend output

```

## Project Structure

```
crypto-twitter-alpha-stream/
├── src/                      # Backend source code
│   ├── index.ts             # Application entry point
│   ├── Application.ts       # Main orchestrator
│   ├── config/              # Configuration management
│   ├── sse/                 # SSE client with reconnection
│   ├── filters/             # Event filtering pipeline
│   ├── streamcore/          # Core event processing
│   ├── outputs/             # Output channels (CLI, Dashboard, Alerts)
│   ├── activeusers/         # Active users fetcher
│   ├── health/              # Health monitoring
│   ├── models/              # Data models and types
│   ├── utils/               # Utility functions (LogSanitizer)
│   ├── validation/          # Input validation (UserFilterValidator)
│   ├── dedup/               # Deduplication cache
│   └── eventbus/            # Event bus for pub/sub
├── frontend/                # Dashboard frontend (Svelte 5 + TypeScript)
│   ├── src/                 # Svelte components and stores
│   ├── build/               # Production build output (served by backend)
│   ├── docs/                # Frontend documentation
│   └── ...                  # Vite, Tailwind, test configs
├── tests/                   # Test files (mirrors src/ structure)
│   ├── unit tests           # Specific examples and edge cases
│   ├── integration tests    # Component interactions
│   └── property tests       # Universal correctness properties
├── config/                  # Configuration files
│   ├── config.json          # Optional JSON config (gitignored)
│   ├── config.example.json  # Example configuration
│   └── README.md            # Configuration guide
├── docs/                    # Documentation
│   ├── API.md               # API documentation
│   └── CONFIGURATION.md     # Detailed configuration guide
├── dist/                    # Compiled backend output
├── .env.example             # Environment variables template
├── .env                     # Local environment variables (gitignored)
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Multi-stage Docker build
└── package.json             # Project metadata and scripts

```


