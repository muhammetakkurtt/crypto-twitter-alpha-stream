# Crypto Twitter Alpha Stream

<div align="center">

![Dashboard Demo](https://github.com/muhammetakkurtt/crypto-twitter-alpha-stream/releases/download/v1.0.0/dashboard-demo.gif)

</div>

Real-time Twitter event streaming application that connects via WebSocket to an [Apify actor](https://apify.com/muhammetakkurtt/crypto-twitter-tracker?fpr=muh) and distributes filtered, deduplicated Twitter events to multiple output channels. Monitor curated crypto Twitter accounts with live CLI streams, interactive web dashboards, and instant alerts.

## Features

- **🔴 Real-time WebSocket streaming** from Apify actor with automatic reconnection and exponential backoff
- **📺 Multiple output channels**: CLI live stream, Web Dashboard, and Alerts (Telegram/Discord/Webhook)
- **🔍 Smart filtering** by users, keywords, and event types (both actor-side and client-side)
- **🚫 Intelligent deduplication** using stable identifiers to prevent redundant notifications
- **🔄 Automatic reconnection** with exponential backoff for resilience
- **🎨 Interactive web dashboard** for visual monitoring and real-time filtering
- **📊 Health monitoring** via HTTP status endpoint
- **⚡ Fast setup** - Get streaming in 5-10 minutes
- **🔌 WebSocket protocol** with subscribe-based channel selection

## Table of Contents

- [Quick Start](#quick-start)
- [WebSocket Protocol](#websocket-protocol)
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

## WebSocket Protocol

The application uses WebSocket (WSS) to connect to the Apify actor for real-time event streaming. Understanding the protocol helps with troubleshooting and advanced configuration.

### Connection Flow

1. **WebSocket Connection**: Client establishes WSS connection to `wss://muhammetakkurtt--crypto-twitter-tracker.apify.actor/`
2. **Authentication**: Token is passed as a query parameter: `?token=YOUR_TOKEN`
3. **Connected Event**: Server sends a "connected" event confirming the connection
4. **Subscribe Message**: Client sends a subscribe message specifying channels and optional user filters
5. **Subscribed Event**: Server confirms subscription with channel and filter details
6. **Event Streaming**: Server streams Twitter events in real-time
7. **Heartbeat**: Server sends WebSocket protocol-level ping frames every 15 seconds (handled automatically)

### Subscribe Message Format

After connecting, the client sends a subscribe message to specify which channels to monitor:

```json
{
  "op": "subscribe",
  "channels": ["all"],
  "users": ["elonmusk", "vitalikbuterin"]
}
```

**Fields**:
- `op`: Always "subscribe"
- `channels`: Array of channel names (see below)
- `users`: Optional array of usernames for actor-side filtering (omitted if no filters)

**Available Channels**:
- `all`: All event types (tweets, follows, profile updates)
- `tweets`: Only tweet events (post_created)
- `following`: Only follow events (follow_created)
- `profile`: Only profile update events (user_updated)

**Multiple Channels**: You can subscribe to multiple channels simultaneously:
```json
{
  "op": "subscribe",
  "channels": ["tweets", "following"]
}
```

**User Filtering**: Include the `users` array for actor-side filtering to reduce events and costs:
```json
{
  "op": "subscribe",
  "channels": ["all"],
  "users": ["elonmusk", "vitalikbuterin", "cz_binance"]
}
```

When you configure user filters in your `.env` file (via the `USERS` environment variable), the application automatically includes them in the subscribe message. The actor then filters events server-side, sending only events from your specified users. This reduces both the number of events delivered to your client and your usage costs.

### Event Format

Events are sent as JSON messages with this structure:

```json
{
  "event_type": "post_created",
  "data": {
    "username": "elonmusk",
    "action": "post_created",
    "tweetId": "123456789",
    "tweet": {
      "id": "123456789",
      "type": "tweet",
      "created_at": "2024-01-15T14:30:22.000Z",
      "body": {
        "text": "Bitcoin is the future...",
        "urls": [],
        "mentions": []
      },
      "author": {
        "handle": "elonmusk",
        "id": "44196397",
        "verified": true,
        "profile": {
          "name": "Elon Musk",
          "avatar": "https://...",
          "bio": "..."
        }
      },
      "metrics": {
        "likes": 1000,
        "retweets": 500,
        "replies": 200,
        "views": 50000
      }
    }
  }
}
```

**Event Types**:
- `connected`: Connection established
- `subscribed`: Subscription confirmed
- `post_created`: New tweet posted
- `follow_created`: User followed another user
- `user_updated`: User profile updated
- `shutdown`: Server shutting down (client will reconnect after 5 seconds)
- `error`: Error occurred (includes error code and message)

### Event Transformation

The application transforms actor events to a standardized internal format:

**Actor Format** (received from WebSocket):
```json
{
  "event_type": "post_created",
  "data": { /* nested tweet/user data */ }
}
```

**Internal Format** (used by application):
```json
{
  "type": "post_created",
  "timestamp": "2024-01-15T14:30:22.000Z",
  "primaryId": "123456789",
  "user": {
    "username": "elonmusk",
    "displayName": "Elon Musk",
    "userId": "44196397"
  },
  "data": { /* complete actor data preserved */ }
}
```

**Transformation Rules**:
- `username`: Extracted with priority: `data.username` → `data.user.handle` → `data.tweet.author.handle`
- `userId`: Extracted from `data.user.id` or `data.tweet.author.id`
- `displayName`: Extracted from `data.user.profile.name` or `data.tweet.author.profile.name`
- `primaryId`: Generated based on event type (tweetId for tweets, userId for follows/updates)
- `data`: Complete deep copy of actor data field

### Deduplication Mechanism

The application uses an intelligent deduplication system to prevent duplicate events from being processed multiple times. This is critical for avoiding redundant notifications and ensuring data consistency.

**Deduplication Key Structure**:

The deduplication key is composed of three parts:
```
{eventType}:{primaryId}:{contentHash}
```

**Components**:

1. **Event Type**: The normalized event type (e.g., `post_created`, `follow_updated`)
2. **Primary ID**: A stable identifier extracted from the event data
3. **Content Hash**: A hash of the event data to detect content changes

**Stable Identifier Extraction**:

The application uses stable identifiers instead of timestamps for the `primaryId` field:

- **Tweet Events** (`post_created`, `post_updated`):
  - Uses `tweetId` or `tweet.id` from the event data
  - Example: `"123456789"`
  - Ensures the same tweet always has the same ID

- **Follow Events** (`follow_created`, `follow_updated`):
  - Combines follower and followed user IDs: `{userId}-{followingId}`
  - Example: `"44196397-123456"`
  - Ensures the same follow relationship always has the same ID

- **Profile Events** (`user_updated`, `profile_updated`, `profile_pinned`):
  - Uses the user's ID from `user.id`
  - Example: `"44196397"`
  - Ensures the same user's updates have the same base ID

- **Fallback**: Only when no stable ID is available, uses `{username}-{timestamp}`

**Why Stable IDs Matter**:

Using stable identifiers instead of timestamps ensures:
- The same event received multiple times is correctly identified as a duplicate
- Events with different timestamps but identical content are deduplicated
- Deduplication works reliably across reconnections and restarts

**Content Hash**:

The content hash detects when the same entity has different content:
- Same tweet ID with different text → Different hash → Processed as update
- Same follow relationship → Same hash → Deduplicated
- Profile update with changed bio → Different hash → Processed as new event

**Example - Tweet Deduplication**:

Event 1 (received at 10:00):
```json
{
  "type": "post_created",
  "primaryId": "123456789",
  "data": { "tweet": { "body": { "text": "Hello world" } } }
}
```
Dedup key: `post_created:123456789:abc123`

Event 2 (same tweet received at 10:05):
```json
{
  "type": "post_created",
  "primaryId": "123456789",
  "data": { "tweet": { "body": { "text": "Hello world" } } }
}
```
Dedup key: `post_created:123456789:abc123` ← **Same key, deduplicated**

Event 3 (tweet updated at 10:10):
```json
{
  "type": "post_updated",
  "primaryId": "123456789",
  "data": { "tweet": { "body": { "text": "Hello world updated" } } }
}
```
Dedup key: `post_updated:123456789:def456` ← **Different type and hash, processed**

**Cache Behavior**:

- **TTL (Time-To-Live)**: Dedup keys expire after 60 seconds by default (configurable via `DEDUP_TTL`)
- **Memory Efficient**: Old entries are automatically removed after TTL expires
- **Automatic Cleanup**: No manual cache management required

**Configuration**:

```env
DEDUP_TTL=60  # Dedup cache TTL in seconds (default: 60)
```

**Benefits**:

✅ Prevents duplicate notifications to users
✅ Reduces unnecessary processing overhead
✅ Works reliably across reconnections
✅ Detects content changes for update events
✅ Memory efficient with automatic expiration

**Implementation Location**: The deduplication logic is implemented in `DedupCache.ts` and `generateDedupKey()` function.

### Control Events

**Connected Event**:
```json
{
  "event_type": "connected",
  "data": {
    "connection_id": "ws_1234567890_abc123",
    "channels": [],
    "filter": {"enabled": false}
  }
}
```

**Subscribed Event**:
```json
{
  "event_type": "subscribed",
  "data": {
    "channels": ["all"],
    "filter": {
      "enabled": true,
      "users_count": 2,
      "sample_users": ["elonmusk", "vitalikbuterin"]
    }
  }
}
```

**Shutdown Event**:
```json
{
  "event_type": "shutdown",
  "data": {
    "message": "Server shutting down"
  }
}
```

When a shutdown event is received, the client waits 5 seconds and then automatically reconnects.

**Error Event**:
```json
{
  "event_type": "error",
  "data": {
    "code": "INVALID_SUBSCRIPTION",
    "message": "channels must be an array"
  }
}
```

### Heartbeat and Connection Health

The WebSocket connection uses protocol-level ping/pong frames for health monitoring:

- **Server Ping**: Server sends WebSocket ping frames every 15 seconds
- **Client Pong**: The `ws` library automatically responds with pong frames
- **No Application Logic**: Heartbeat is handled entirely by the WebSocket protocol, not by application code
- **Connection Detection**: If pings fail, the connection is considered dead and reconnection is triggered

### Reconnection Behavior

The client implements automatic reconnection with exponential backoff:

**Exponential Backoff Formula**:
```
delay = min(initialDelay × multiplier^attempts, maxDelay)
```

**Default Configuration**:
- Initial delay: 1000ms (1 second)
- Max delay: 30000ms (30 seconds)
- Backoff multiplier: 2.0
- Max attempts: 0 (infinite)

**Reconnection Sequence**:
1. Connection closes unexpectedly
2. Calculate delay using exponential backoff
3. Wait for calculated delay
4. Attempt reconnection
5. On success: Reset attempt counter, re-subscribe to channels
6. On failure: Increment attempt counter, repeat from step 2

**Special Cases**:
- **Authentication Failure (401)**: No reconnection attempted
- **Server Shutdown**: Wait 5 seconds, then reconnect (no exponential backoff)
- **Max Attempts Reached**: Stop reconnection and emit fatal error (if maxAttempts > 0)

### WebSocket URL Formats

The application accepts flexible URL formats and automatically converts them:

**Accepted Formats**:
- `http://host` → Converted to `ws://host` for WebSocket
- `https://host` → Converted to `wss://host` for WebSocket
- `ws://host` → Used as-is for WebSocket
- `wss://host` → Used as-is for WebSocket

**REST Endpoints**: For HTTP endpoints like `/active-users` and `/health`, the URL is converted back:
- `ws://host` → `http://host`
- `wss://host` → `https://host`

This allows you to configure the base URL in any format, and the application handles the conversion automatically.

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
3. Connect to the actor and send a subscribe message with the users field
4. Receive only events from your specified users (filtered server-side)

**How User Filtering Works**:

When you configure user filters, the application includes them in the WebSocket subscribe message:

```json
{
  "op": "subscribe",
  "channels": ["all"],
  "users": ["elonmusk", "vitalikbuterin", "cz_binance"]
}
```

The actor receives this subscribe message and applies the user filter server-side. Only events from the specified users are sent to your client over the WebSocket connection. This means:

- **Reduced Events**: You only receive events from your specified users
- **Lower Costs**: You're only charged for events actually delivered to your client
- **Server-Side Filtering**: Filtering happens at the source, not in your client
- **Efficient**: No bandwidth wasted on events you don't want

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

## Runtime Subscription Management

The dashboard provides runtime subscription management, allowing you to modify subscription parameters (channels and users) without restarting the application. This feature uses a staged-apply UX pattern with security controls.

### Overview

Runtime subscription management enables you to:
- Change monitored channels (all, tweets, following, profile) on the fly
- Update user filters without restarting
- Transition to idle mode (empty channels) to pause monitoring
- View current subscription state and history

**Important**: Runtime changes are temporary and do not persist across restarts. To make changes permanent, edit your configuration file.

### Staged-Apply UX Pattern

The dashboard uses a staged-apply workflow to prevent accidental changes:

1. **Draft Changes**: Modify channels and users in the UI (staged state)
2. **Review**: See what will change before applying
3. **Apply**: Click "Apply Changes" to send to server
4. **Broadcast**: All connected dashboards receive the update

**Benefits**:
- Preview changes before applying
- Discard unwanted changes
- Clear indication of unsaved changes
- Atomic updates (all or nothing)

**Example Workflow**:

```
Current State: channels=["all"], users=["elonmusk"]
         ↓
User modifies in UI: channels=["tweets"], users=["elonmusk", "vitalikbuterin"]
         ↓
Staged state updated (not yet applied)
         ↓
User clicks "Apply Changes"
         ↓
Server updates subscription atomically
         ↓
All dashboards receive broadcast and update
```

### Security Controls

Subscription modifications are restricted based on client origin:

**Control Clients** (localhost connections):
- Can read subscription state
- Can modify subscriptions
- Identified by loopback addresses: 127.0.0.1, ::1, ::ffff:127.0.0.1, localhost

**Read-Only Clients** (remote connections):
- Can read subscription state
- Cannot modify subscriptions
- Attempts to modify return "Forbidden" error

**Why This Matters**:
- Prevents unauthorized subscription changes from remote clients
- Ensures only local operators can modify monitoring configuration
- Protects against accidental or malicious changes

**Example**:

```javascript
// Local client (127.0.0.1)
socket.emit('setRuntimeSubscription', {...});
// ✅ Success: Subscription updated

// Remote client (192.168.1.100)
socket.emit('setRuntimeSubscription', {...});
// ❌ Error: Forbidden
```

### Idle Mode

Idle mode allows you to pause monitoring while maintaining the connection:

**What is Idle Mode?**
- Empty channels array: `channels: []`
- Connection to actor remains active
- No events are received or processed
- No event processing costs incurred

**When to Use Idle Mode**:
- Temporarily pause monitoring without disconnecting
- Reduce costs during low-activity periods
- Maintain connection for quick resume

**How to Enter Idle Mode**:

Via Dashboard:
1. Uncheck all channels in the Subscription Panel
2. Click "Apply Changes"
3. Mode changes to "idle"

Via API:
```javascript
socket.emit('setRuntimeSubscription', {
  channels: [],
  users: []
}, (response) => {
  // response.data.mode === "idle"
});
```

**How to Exit Idle Mode**:

Simply select channels and apply:
```javascript
socket.emit('setRuntimeSubscription', {
  channels: ['all'],
  users: []
}, (response) => {
  // response.data.mode === "active"
});
```

### Usage Examples

#### Example 1: View Current Subscription

```javascript
socket.emit('getRuntimeSubscription', (response) => {
  if (response.success) {
    console.log('Channels:', response.data.channels);
    console.log('Users:', response.data.users);
    console.log('Mode:', response.data.mode);
    console.log('Source:', response.data.source);
    console.log('Updated:', response.data.updatedAt);
  }
});
```

#### Example 2: Change Channels

```javascript
// Switch from all events to tweets only
socket.emit('setRuntimeSubscription', {
  channels: ['tweets'],
  users: ['elonmusk', 'vitalikbuterin']
}, (response) => {
  if (response.success) {
    console.log('Now monitoring tweets only');
  }
});
```

#### Example 3: Add User Filters

```javascript
// Add user filters to reduce event volume
socket.emit('setRuntimeSubscription', {
  channels: ['all'],
  users: ['elonmusk', 'vitalikbuterin', 'cz_binance']
}, (response) => {
  if (response.success) {
    console.log('Now monitoring 3 users only');
  }
});
```

#### Example 4: Enter Idle Mode

```javascript
// Pause monitoring
socket.emit('setRuntimeSubscription', {
  channels: [],
  users: []
}, (response) => {
  if (response.success) {
    console.log('Entered idle mode - no events will be received');
  }
});
```

#### Example 5: Listen for Updates

```javascript
// Listen for subscription changes from other clients
socket.on('runtimeSubscriptionUpdated', (state) => {
  console.log('Subscription updated by another client');
  console.log('New channels:', state.channels);
  console.log('New users:', state.users);
  // Update UI to reflect new state
});
```

### Global vs Local Filters

It's important to understand the difference between global subscription and local dashboard filters:

**Global Subscription** (Runtime Subscription Management):
- Affects all outputs: CLI, Dashboard, Alerts
- Filters at the actor level (reduces events delivered)
- Reduces costs (fewer events = lower charges)
- Changes broadcast to all connected clients
- Managed via Subscription Panel in dashboard

**Local Dashboard Filters** (Client-Side):
- Affects only the current dashboard view
- Filters after events are received
- No cost impact (events already delivered)
- Not shared with other clients
- Managed via filter controls in dashboard sidebar

**Example**:

```
Global Subscription: users=["elonmusk", "vitalikbuterin"]
         ↓
Actor sends only these 2 users' events
         ↓
Dashboard receives events from 2 users
         ↓
Local Filter: keywords=["bitcoin"]
         ↓
Dashboard displays only bitcoin-related events
```

**Best Practice**: Use global subscription to control event volume and costs, then use local filters for UI refinement.

### Copying Local Selections to Global Subscription

The dashboard provides a convenient "Use selected users" feature to copy your local filter selections to the global upstream subscription:

**Workflow**:
1. Select users in the left sidebar (Local Filters section)
2. Navigate to the Subscription Panel (Global Subscription section)
3. Click "Use selected users (N)" button where N is the count of selected users
4. Review the copied users in the upstream draft
5. Click "Apply Changes" to update the global subscription

**Important Notes**:
- This is a one-time copy operation, not automatic synchronization
- Local selections do NOT auto-sync to upstream subscription
- You must manually click "Use selected users" to copy selections
- After copying, you still need to click "Apply Changes" to activate
- The copy operation normalizes usernames (trim, lowercase, unique, sort)

**Example Workflow**:

```
Step 1: Select users in left sidebar
  Local Filters: ["elonmusk", "vitalikbuterin", "cz_binance"]
         ↓
Step 2: Click "Use selected users (3)"
  Upstream Draft: ["cz_binance", "elonmusk", "vitalikbuterin"] (normalized)
         ↓
Step 3: Click "Apply Changes"
  Global Subscription: ["cz_binance", "elonmusk", "vitalikbuterin"]
         ↓
Actor now sends only these 3 users' events
```

**Why Manual Copy?**:
- Prevents accidental global changes from local experimentation
- Gives you control over when to apply cost-affecting changes
- Allows you to review and adjust before applying
- Maintains clear separation between local and global scopes

**Additional Features**:
- "Clear upstream users" button to quickly remove all upstream user filters
- Visual distinction between Local and Global sections in the dashboard
- Warning banners explaining the difference and global impact

### Persistence and Configuration

**Runtime Changes Are Temporary**:
- Runtime subscription changes do not persist across restarts
- After restart, the application loads subscription from configuration file
- The `source` field indicates origin: "config" (from file) or "runtime" (modified)

**Making Changes Permanent**:

To make runtime changes permanent, edit your configuration file:

1. Note the current runtime subscription state
2. Edit `.env` or `config/config.json`
3. Update `CHANNELS` and `USERS` to match desired state
4. Restart the application

**Example**:

```env
# Before restart (runtime changes)
# channels: ["tweets"], users: ["elonmusk"]

# Edit .env to make permanent
CHANNELS=tweets
USERS=elonmusk

# After restart
# source: "config", channels: ["tweets"], users: ["elonmusk"]
```

See [Configuration Guide](docs/CONFIGURATION.md) for details on making changes permanent.

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
# Supports http/https/ws/wss formats - automatically converted
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor

# Select channels (comma-separated: all, tweets, following, profile)
# Can specify multiple channels to subscribe to multiple event types
CHANNELS=all

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
- Switch between channels
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
CHANNELS=tweets
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

### WebSocket Endpoint

**WebSocket** connection for real-time event streaming from the Apify actor.

**URL**: `wss://muhammetakkurtt--crypto-twitter-tracker.apify.actor/`

**Authentication**: Token passed as query parameter: `?token=YOUR_TOKEN`

**Protocol**:
1. Client connects to WebSocket endpoint with token
2. Server sends "connected" event
3. Client sends subscribe message with channels and optional user filters
4. Server sends "subscribed" confirmation
5. Server streams events in real-time
6. Server sends protocol-level ping frames every 15 seconds (handled automatically)

**Subscribe Message**:
```json
{
  "op": "subscribe",
  "channels": ["all"],
  "users": ["elonmusk", "vitalikbuterin"]
}
```

See [WebSocket Protocol](#websocket-protocol) section for detailed protocol documentation.

### Health Status Endpoint

**GET** `/status`

Returns application health and statistics.

**Port**: `3001` (configurable via `HEALTH_PORT`)

**Response**:
```json
{
  "connection": {
    "status": "connected",
    "channels": ["all"],
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

**Problem**: "Failed to connect to WebSocket endpoint"

**Solutions**:
- Verify your `APIFY_TOKEN` is correct
- Check your internet connection
- Ensure the Apify actor is running at https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
- Check the actor's health endpoint: `curl -H "Authorization: Bearer YOUR_TOKEN" https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/health`
- Verify your firewall allows WebSocket connections (port 443 for wss://)
- Check if you're behind a proxy that blocks WebSocket connections

**Problem**: "WebSocket connection closed unexpectedly"

**Solutions**:
- Check application logs for close code and reason
- Normal closure (code 1000): Expected shutdown, client will reconnect
- Abnormal closure (code 1006): Network issue, client will reconnect with exponential backoff
- Authentication failure (code 1008): Verify your token is correct
- Enable debug mode to see detailed connection logs: `DEBUG=true npm start`

**Problem**: "Subscription timeout - no subscribed event received"

**Solutions**:
- Verify your channels configuration is valid (all, tweets, following, profile)
- Check that channels is an array in the subscribe message
- Ensure the subscribe message is sent within 30 seconds of connection
- Review application logs for subscription errors
- Try with a single channel first: `CHANNELS=all`

**Problem**: "Authentication failed"

**Solutions**:
- Verify your token is set correctly in `.env`
- Ensure no extra spaces or quotes around the token
- Generate a new token from [Apify Console](https://console.apify.com/settings/integrations?fpr=muh)

### No Events Appearing

**Problem**: No events appearing

**Solutions**:
- Check if filters are too restrictive (try removing `USERS` and `KEYWORDS`)
- If using `USERS` filter, verify usernames are in the active users list:
  ```bash
  curl -H "Authorization: Bearer YOUR_TOKEN" \
       https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
  ```
- Check validation warnings on startup for invalid usernames
- Verify the selected channels have active events
- Check if tracked accounts are actually posting
- Review the active users list: `curl http://localhost:3001/status`
- Verify subscription was successful (check logs for "subscribed" event)
- Enable debug mode to see raw events: `DEBUG=true npm start`

**Problem**: Configured user filters but receiving no events

**Solutions**:
- Check startup logs for validation warnings about invalid usernames
- Verify your usernames match those in the active users list (case-insensitive)
- Ensure usernames don't include the @ symbol
- Try with a well-known account like `elonmusk` to test
- Check that the actor is actually monitoring those accounts

### WebSocket-Specific Issues

**Problem**: "Reconnection loop - constantly reconnecting"

**Solutions**:
- Check if your token is valid (401 errors prevent reconnection)
- Verify the actor is running and accepting connections
- Check if you're hitting rate limits
- Review reconnection configuration (may be too aggressive):
  ```env
  RECONNECT_INITIAL_DELAY=1000
  RECONNECT_MAX_DELAY=30000
  RECONNECT_BACKOFF_MULTIPLIER=2.0
  ```
- Enable debug mode to see reconnection attempts: `DEBUG=true npm start`

**Problem**: "Events are delayed or arriving in bursts"

**Solutions**:
- Check network latency to the actor
- Verify WebSocket connection is stable (check for reconnections in logs)
- Check if the actor is under heavy load
- Monitor bufferedAmount in WebSocket connection (visible in debug mode)
- Ensure your system has sufficient resources (CPU, memory)

**Problem**: "Heartbeat timeout - connection considered dead"

**Solutions**:
- WebSocket ping/pong is handled automatically by the protocol
- If heartbeat fails, it indicates network issues
- Check your network stability and firewall settings
- Verify WebSocket connections aren't being terminated by a proxy
- The client will automatically reconnect with exponential backoff

**Problem**: "Server shutdown event received"

**Solutions**:
- This is normal - the actor is restarting or deploying
- The client automatically waits 5 seconds and reconnects
- No action needed - this is handled gracefully
- After reconnection, the client re-subscribes to your channels

**Problem**: "Invalid subscribe message error"

**Solutions**:
- Verify `CHANNELS` is set correctly (comma-separated: all,tweets,following,profile)
- Ensure channels are valid values (all, tweets, following, profile)
- Check that the subscribe message is properly formatted JSON
- Review application logs for the exact error message
- Try with a single channel first: `CHANNELS=all`

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

1. **Raw Actor Events** (WSSClient):
   - Complete event structure as received from the WebSocket
   - Logged before any transformation occurs
   - Helps verify what data is actually being sent

2. **Transformed Events** (WSSClient):
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

6. **WebSocket Connection Events**:
   - Connection state changes
   - Subscribe message sent
   - Subscribed confirmation received
   - Reconnection attempts and delays
   - Shutdown events and reconnection timing

**Example Debug Output**:

```
[WSSClient] WebSocket connected
[WSSClient] Sending subscribe message: {"op":"subscribe","channels":["all"],"users":["elonmusk"]}
[WSSClient] Subscribed successfully: {"channels":["all"],"filter":{"enabled":true,"users_count":1}}
[WSSClient] Raw actor event: {
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

[WSSClient] Transformed event: {
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
npm test -- WSSClient.test.ts
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
│   ├── ws/                   # WebSocket client with reconnection
│   │   └── WSSClient.ts      # WebSocket wrapper with exponential backoff
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
│   ├── ws/                  # WebSocket client with reconnection
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


