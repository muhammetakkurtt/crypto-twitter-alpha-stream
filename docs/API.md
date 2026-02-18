# API Documentation

This document describes all HTTP endpoints and WebSocket events exposed by the Crypto Twitter Alpha Stream application, as well as the WebSocket protocol used to connect to the Apify actor.

## Table of Contents

- [Apify Actor WebSocket API](#apify-actor-websocket-api)
  - [WebSocket Connection](#websocket-connection)
  - [Subscribe Protocol](#subscribe-protocol)
  - [Event Streaming](#event-streaming)
  - [Control Events](#control-events)
  - [Error Handling](#error-handling)
- [Application HTTP Endpoints](#application-http-endpoints)
  - [Health Status Endpoint](#health-status-endpoint)
  - [Active Users Endpoint](#active-users-endpoint)
- [Dashboard WebSocket API](#dashboard-websocket-api)
  - [Connection](#connection)
  - [Events](#events)
  - [Client-to-Server Messages](#client-to-server-messages)
  - [Server-to-Client Messages](#server-to-client-messages)
- [Data Models](#data-models)

---

## Apify Actor WebSocket API

The application connects to the Apify actor via WebSocket for real-time event streaming. This section documents the WebSocket protocol used for actor communication.

### WebSocket Connection

**Endpoint**: `wss://muhammetakkurtt--crypto-twitter-tracker.apify.actor/`

**Protocol**: WebSocket (WSS)

**Authentication**: Token passed as query parameter

**Connection URL Format**:
```
wss://muhammetakkurtt--crypto-twitter-tracker.apify.actor/?token=YOUR_APIFY_TOKEN
```

**Connection Flow**:
1. Client establishes WebSocket connection with token in query string
2. Server sends "connected" event confirming connection
3. Client sends subscribe message specifying channels and optional user filters
4. Server sends "subscribed" event confirming subscription
5. Server streams events in real-time
6. Server sends WebSocket protocol-level ping frames every 15 seconds (handled automatically by ws library)

**Example Connection** (Node.js with ws library):
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('wss://muhammetakkurtt--crypto-twitter-tracker.apify.actor/?token=YOUR_TOKEN');

ws.on('open', () => {
  console.log('Connected to actor');
  
  // Send subscribe message
  ws.send(JSON.stringify({
    op: 'subscribe',
    channels: ['all'],
    users: ['elonmusk', 'vitalikbuterin']
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});

ws.on('close', (code, reason) => {
  console.log('Connection closed:', code, reason);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Subscribe Protocol

After connecting, the client must send a subscribe message within 30 seconds to specify which channels to monitor.

**Subscribe Message Format**:
```json
{
  "op": "subscribe",
  "channels": ["all"],
  "users": ["elonmusk", "vitalikbuterin"]
}
```

**Fields**:
- `op`: Always "subscribe" (required)
- `channels`: Array of channel names (required)
- `users`: Array of usernames for actor-side filtering (optional, omit if no filters)

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

**User Filtering**: Include the `users` array for actor-side filtering:
```json
{
  "op": "subscribe",
  "channels": ["all"],
  "users": ["elonmusk", "vitalikbuterin", "cz_binance"]
}
```

When the `users` field is included in the subscribe message, the actor applies server-side filtering and only sends events from the specified users to your client. This reduces the number of events delivered and lowers your usage costs.

**Without User Filtering**: Omit the `users` field to receive all events:
```json
{
  "op": "subscribe",
  "channels": ["all"]
}
```

When the `users` field is omitted, the actor sends events from all monitored users to your client.

**Subscription Confirmation**: After sending the subscribe message, the server responds with a "subscribed" event:
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

The `filter` object in the subscribed event indicates whether user filtering is active:
- `enabled: true` - User filtering is active (users field was included in subscribe message)
- `enabled: false` - No user filtering (users field was omitted)
- `users_count` - Number of users in the filter
- `sample_users` - Sample of filtered usernames (may not include all users)

**Example: Filtered Subscription**

Client sends:
```json
{
  "op": "subscribe",
  "channels": ["tweets"],
  "users": ["elonmusk", "vitalikbuterin"]
}
```

Server responds:
```json
{
  "event_type": "subscribed",
  "data": {
    "channels": ["tweets"],
    "filter": {
      "enabled": true,
      "users_count": 2,
      "sample_users": ["elonmusk", "vitalikbuterin"]
    }
  }
}
```

Result: Client receives only tweet events from elonmusk and vitalikbuterin.

**Example: Unfiltered Subscription**

Client sends:
```json
{
  "op": "subscribe",
  "channels": ["all"]
}
```

Server responds:
```json
{
  "event_type": "subscribed",
  "data": {
    "channels": ["all"],
    "filter": {
      "enabled": false
    }
  }
}
```

Result: Client receives all events from all monitored users.

**Subscription Timeout**: If no subscribe message is sent within 30 seconds, the server closes the connection with code 1008 (Policy Violation).

### Event Streaming

After subscription, the server streams events in real-time as JSON messages.

**Event Message Format**:
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
- `post_created`: New tweet posted
- `follow_created`: User followed another user
- `user_updated`: User profile updated

See [Data Models](#data-models) section for complete event structures.

### Control Events

The server sends control events for connection management and status updates.

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

When a shutdown event is received, the client should wait 5 seconds and then reconnect automatically.

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

**Common Error Codes**:
- `INVALID_SUBSCRIPTION`: Subscribe message format is invalid
- `INVALID_CHANNELS`: Channel names are invalid
- `SUBSCRIPTION_TIMEOUT`: No subscribe message received within 30 seconds
- `AUTHENTICATION_FAILED`: Invalid or missing token

### Error Handling

**WebSocket Close Codes**:
- `1000` (Normal Closure): Clean disconnect, client does NOT reconnect
- `1006` (Abnormal Closure): Network issue, client reconnects with exponential backoff
- `1008` (Policy Violation): Authentication failure or subscription timeout, client does NOT reconnect
- `1011` (Internal Error): Server error, client reconnects with exponential backoff

**Heartbeat**: The server sends WebSocket protocol-level ping frames every 15 seconds. The ws library automatically responds with pong frames. No application-level handling is required.

**Reconnection**: The client implements automatic reconnection with exponential backoff:
- Initial delay: 1000ms (1 second)
- Max delay: 30000ms (30 seconds)
- Backoff multiplier: 2.0
- Max attempts: 0 (infinite)

**Reconnection Formula**:
```
delay = min(initialDelay × multiplier^attempts, maxDelay)
```

**Special Cases**:
- Authentication failure (code 1008): No reconnection attempted
- Server shutdown: Wait 5 seconds, then reconnect (no exponential backoff)
- Max attempts reached: Stop reconnection and emit fatal error (if maxAttempts > 0)

---

## Application HTTP Endpoints

### Health Status Endpoint

Returns current application health, connection status, and statistics.

**Endpoint**: `GET /status`

**Port**: `3001` (default, configurable via `HEALTH_PORT` environment variable)

**Authentication**: None

**Response Format**: JSON

**Response Schema**:

```typescript
{
  connection: {
    status: 'connected' | 'disconnected' | 'reconnecting',
    channels: string[],
    uptime: number  // seconds since connection established
  },
  events: {
    total: number,      // Total events received
    delivered: number,  // Events delivered to outputs
    deduped: number,    // Events filtered as duplicates
    rate: number        // Events per second
  },
  alerts: {
    telegram: {
      sent: number,     // Successfully sent alerts
      failed: number    // Failed delivery attempts
    },
    discord: {
      sent: number,
      failed: number
    },
    webhook: {
      sent: number,
      failed: number
    }
  },
  filters: {
    users: string[],    // Active user filters
    keywords: string[]  // Active keyword filters
  }
}
```

**Example Request**:

```bash
curl http://localhost:3001/status
```

**Example Response**:

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
    "telegram": {
      "sent": 45,
      "failed": 2
    },
    "discord": {
      "sent": 45,
      "failed": 0
    },
    "webhook": {
      "sent": 0,
      "failed": 0
    }
  },
  "filters": {
    "users": ["elonmusk", "vitalikbuterin"],
    "keywords": ["bitcoin", "ethereum"]
  }
}
```

**Status Codes**:

- `200 OK` - Status retrieved successfully
- `500 Internal Server Error` - Server error occurred

**Use Cases**:

- Health checks for monitoring systems
- Debugging connection issues
- Tracking event throughput
- Monitoring alert delivery
- Verifying active filters

---

### Active Users Endpoint

Returns the list of Twitter accounts currently being tracked by the Apify actor.

**Note**: This endpoint is provided by the Apify actor, not by this application. The application fetches from this endpoint periodically.

**Endpoint**: `GET /active-users`

**Port**: Apify actor endpoint

**Authentication**: Apify token (handled automatically by the application)

**Response Format**: JSON

**Response Schema**:

```typescript
{
  users: string[]  // Array of Twitter usernames
}
```

**Example Response**:

```json
{
  "users": [
    "elonmusk",
    "vitalikbuterin",
    "cz_binance",
    "SBF_FTX",
    "aantonop",
    "naval"
  ]
}
```

**Caching**:

The application caches the active users list and refreshes it periodically (default: every 4 minutes). The refresh interval is configurable via `ACTIVE_USERS_REFRESH_INTERVAL` environment variable.

**Error Handling**:

If the endpoint is unavailable, the application continues operating with the cached list or an empty list.

---

## Dashboard WebSocket API

The dashboard uses WebSocket (Socket.io) for real-time bidirectional communication between the server and web clients.

### Connection

**Endpoint**: `ws://localhost:3000` (default, configurable via `DASHBOARD_PORT`)

**Protocol**: Socket.io (WebSocket with fallback to HTTP long-polling)

**Authentication**: None (local application)

**Example Connection** (JavaScript):

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to dashboard');
});

socket.on('disconnect', () => {
  console.log('Disconnected from dashboard');
});
```

---

### Events

#### Server-to-Client Events

These events are sent from the server to connected dashboard clients.

##### 1. `event`

Broadcasts a new Twitter event to all connected clients.

**Payload**:

```typescript
{
  type: 'post_created' | 'post_updated' | 'follow_created' | 'follow_updated' | 
        'user_updated' | 'profile_updated' | 'profile_pinned',
  timestamp: string,  // ISO 8601 format
  primaryId: string,  // Tweet ID, User ID, or generated ID
  user: {
    username: string,
    displayName: string,
    userId: string
  },
  data: PostData | ProfileData | FollowingData
}
```

**PostData** (for post_created/post_updated events):

```typescript
{
  tweetId: string,
  username: string,
  action: string,
  tweet?: {
    id: string,
    type: string,
    created_at: string,
    body: {
      text: string,
      urls?: Array<{ name: string; url: string; tco: string }>,
      mentions?: string[]
    },
    author: {
      handle: string,
      id?: string,
      verified?: boolean,
      profile?: { name: string; avatar?: string; bio?: string }
    },
    metrics?: {
      likes?: number,
      retweets?: number,
      replies?: number,
      views?: number
    },
    media?: {
      images?: string[],
      videos?: string[]
    }
  }
}
```

**ProfileData** (for user_updated/profile_updated/profile_pinned events):

```typescript
{
  username: string,
  action: string,
  user?: {
    id: string,
    handle: string,
    verified?: boolean,
    profile?: {
      name: string,
      avatar?: string,
      bio?: string,
      location?: string,
      website?: string
    },
    metrics?: {
      followers?: number,
      following?: number
    }
  },
  pinned?: Array<{
    id: string,
    type: string,
    body: { text: string },
    created_at: string
  }>
}
```

**FollowingData** (for follow_created/follow_updated events):

```typescript
{
  username: string,
  action: string,
  user?: {
    id: string,
    handle: string,
    profile?: { name: string; avatar?: string; bio?: string },
    metrics?: { followers?: number; following?: number }
  },
  following?: {
    id: string,
    handle: string,
    profile?: { name: string; avatar?: string; bio?: string },
    metrics?: { followers?: number; following?: number }
  }
}
```

**Example**:

```javascript
socket.on('event', (event) => {
  console.log('New event:', event);
  // Display event in UI
});
```

**Example Payload**:

```json
{
  "type": "post_created",
  "timestamp": "2024-01-15T14:30:22.000Z",
  "primaryId": "1234567890",
  "user": {
    "username": "elonmusk",
    "displayName": "Elon Musk",
    "userId": "44196397"
  },
  "data": {
    "tweetId": "1234567890",
    "username": "elonmusk",
    "action": "post_created",
    "tweet": {
      "id": "1234567890",
      "type": "tweet",
      "created_at": "2024-01-15T14:30:22.000Z",
      "body": {
        "text": "Bitcoin is the future of money"
      },
      "author": {
        "handle": "elonmusk",
        "id": "44196397",
        "verified": true,
        "profile": {
          "name": "Elon Musk"
        }
      },
      "metrics": {
        "likes": 15000,
        "retweets": 3000,
        "replies": 500
      }
    }
  }
}
```

##### 2. `stats`

Broadcasts updated statistics to all connected clients.

**Frequency**: Sent periodically (every 10 seconds) and when significant changes occur.

**Payload**:

```typescript
{
  total: number,      // Total events received
  delivered: number,  // Events delivered to outputs
  deduped: number,    // Events filtered as duplicates
  byType: {
    post_created: number,
    post_updated: number,
    follow_created: number,
    follow_updated: number,
    user_updated: number,
    profile_updated: number,
    profile_pinned: number
  },
  rate: number,       // Events per minute
  startTime: string,  // ISO 8601 timestamp
  lastEventTime: string  // ISO 8601 timestamp
}
```

**Example**:

```javascript
socket.on('stats', (stats) => {
  console.log('Updated stats:', stats);
  // Update stats display in UI
});
```

**Example Payload**:

```json
{
  "total": 1250,
  "delivered": 980,
  "deduped": 270,
  "byType": {
    "post_created": 850,
    "post_updated": 50,
    "follow_created": 20,
    "follow_updated": 10,
    "user_updated": 30,
    "profile_updated": 15,
    "profile_pinned": 5
  },
  "rate": 2.5,
  "startTime": "2024-01-15T14:00:00.000Z",
  "lastEventTime": "2024-01-15T14:30:22.000Z"
}
```

##### 3. `connection-status`

Broadcasts WebSocket connection status changes to all connected clients.

**Payload**:

```typescript
{
  status: 'connected' | 'disconnected' | 'reconnecting',
  channels: string[],
  timestamp: string  // ISO 8601 format
}
```

**Example**:

```javascript
socket.on('connection-status', (status) => {
  console.log('Connection status:', status);
  // Update connection indicator in UI
});
```

**Example Payload**:

```json
{
  "status": "connected",
  "channels": ["all"],
  "timestamp": "2024-01-15T14:30:22.000Z"
}
```

##### 4. `active-users`

Broadcasts the list of active Twitter users being tracked.

**Frequency**: Sent on client connection and when the list is refreshed (every 5 minutes by default).

**Payload**:

```typescript
{
  users: string[],  // Array of Twitter usernames
  timestamp: string  // ISO 8601 format
}
```

**Example**:

```javascript
socket.on('active-users', (data) => {
  console.log('Active users:', data.users);
  // Update active users list in UI
});
```

**Example Payload**:

```json
{
  "users": [
    "elonmusk",
    "vitalikbuterin",
    "cz_binance",
    "SBF_FTX"
  ],
  "timestamp": "2024-01-15T14:30:22.000Z"
}
```

---

#### Client-to-Server Messages

##### 1. `getRuntimeSubscription`

Requests the current runtime subscription state from the server.

**Direction**: Client → Server

**Parameters**: None

**Response** (via callback):

```typescript
{
  success: boolean,
  data?: RuntimeSubscriptionState,
  error?: string
}
```

**RuntimeSubscriptionState**:

```typescript
{
  channels: Channel[],           // Active subscription channels
  users: string[],               // User filters (empty = all users)
  mode: 'active' | 'idle',       // Subscription mode
  source: 'config' | 'runtime',  // Origin of current state
  updatedAt: string              // ISO 8601 timestamp
}
```

**Example**:

```javascript
socket.emit('getRuntimeSubscription', (response) => {
  if (response.success) {
    console.log('Current subscription:', response.data);
  } else {
    console.error('Error:', response.error);
  }
});
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "channels": ["all"],
    "users": ["elonmusk", "vitalikbuterin"],
    "mode": "active",
    "source": "runtime",
    "updatedAt": "2024-01-15T14:30:22.000Z"
  }
}
```

**Error Responses**:

```json
{
  "error": "StreamCore not initialized"
}
```

##### 2. `setRuntimeSubscription`

Updates the runtime subscription configuration. Only available to control clients (localhost connections).

**Direction**: Client → Server

**Security**: Control clients only (loopback addresses: 127.0.0.1, ::1, localhost)

**Parameters**:

```typescript
{
  channels: Channel[],  // New channels (empty array = idle mode)
  users: string[]       // New user filters (empty array = all users)
}
```

**Response** (via callback):

```typescript
{
  success: boolean,
  data?: RuntimeSubscriptionState,
  error?: string
}
```

**Example**:

```javascript
socket.emit('setRuntimeSubscription', {
  channels: ['tweets', 'following'],
  users: ['elonmusk', 'vitalikbuterin', 'cz_binance']
}, (response) => {
  if (response.success) {
    console.log('Subscription updated:', response.data);
  } else {
    console.error('Error:', response.error);
  }
});
```

**Example Success Response**:

```json
{
  "success": true,
  "data": {
    "channels": ["tweets", "following"],
    "users": ["elonmusk", "vitalikbuterin", "cz_binance"],
    "mode": "active",
    "source": "runtime",
    "updatedAt": "2024-01-15T14:35:10.000Z"
  }
}
```

**Error Responses**:

```json
{
  "error": "Forbidden: subscription modifications only allowed from local control clients"
}
```

```json
{
  "error": "Invalid payload: channels array required"
}
```

```json
{
  "error": "Another subscription update is already in progress"
}
```

```json
{
  "error": "Cannot update subscription: connection state is disconnected"
}
```

```json
{
  "error": "Invalid channel: invalid_channel"
}
```

**Idle Mode**: Setting an empty channels array transitions to idle mode:

```javascript
socket.emit('setRuntimeSubscription', {
  channels: [],
  users: []
}, (response) => {
  // response.data.mode will be "idle"
});
```

**Security Note - Control Client Detection**:

⚠️ **Important**: The control client check uses `socket.handshake.address` to determine if a connection originates from localhost. This implementation has limitations in certain deployment scenarios:

**How It Works**:
- The server checks if the client's IP address matches loopback addresses: `127.0.0.1`, `::1`, `::ffff:127.0.0.1`, or `localhost`
- Connections from these addresses are classified as "control clients" and can modify subscriptions
- All other connections are "read-only clients" and can only view subscription state

**Limitations**:
1. **Reverse Proxies**: If the application is behind a reverse proxy (nginx, Apache, etc.), `socket.handshake.address` will show the proxy's IP address, not the original client's IP
2. **X-Forwarded-For Not Checked**: The implementation does NOT check the `X-Forwarded-For` header, which means:
   - Remote clients connecting through a proxy may appear as local if the proxy is on localhost
   - True client IP addresses are not considered when behind a proxy
3. **SSH Tunnels**: Clients connecting via SSH port forwarding will appear as localhost connections and gain control access
4. **Docker/Container Networks**: Container networking may affect IP address detection depending on network configuration

**Deployment Best Practices**:

For production deployments where security is critical:

1. **Direct Connection Only**: Deploy the dashboard server without a reverse proxy, or ensure the proxy preserves client IP addresses
2. **Firewall Rules**: Use firewall rules to restrict access to the dashboard port (default: 3000) to trusted networks only
3. **VPN/Private Network**: Deploy on a private network or VPN where all connections are from trusted sources
4. **SSH Tunnel**: If remote access is needed, use SSH tunneling to forward the port securely:
   ```bash
   ssh -L 3000:localhost:3000 user@server
   ```
5. **Authentication Layer**: Consider adding an authentication layer (API keys, OAuth, etc.) in front of the dashboard for production use
6. **Network Segmentation**: Deploy the dashboard on a management network separate from public-facing services

**Example Scenarios**:

✅ **Secure**: Direct connection from localhost
```
Client (127.0.0.1) → Dashboard Server
Result: Control client, can modify subscriptions
```

✅ **Secure**: SSH tunnel from remote machine
```
Remote Client → SSH Tunnel → localhost:3000 → Dashboard Server
Result: Appears as 127.0.0.1, control client access
```

⚠️ **Potentially Insecure**: Reverse proxy without proper configuration
```
Remote Client (192.168.1.100) → Nginx (localhost) → Dashboard Server
Result: Server sees nginx's localhost IP, grants control access
```

⚠️ **Potentially Insecure**: Docker bridge network
```
Remote Client → Docker Host → Container (172.17.0.1) → Dashboard Server
Result: Depends on Docker network configuration
```

**Checking Your Configuration**:

To verify how your deployment detects client addresses:

1. Connect to the dashboard from different sources (localhost, remote, proxy)
2. Check the server logs for client classification:
   ```
   [DashboardOutput] Client abc123 is CONTROL
   [DashboardOutput] Client def456 is READ-ONLY
   ```
3. Test subscription modification from each source to confirm access control

**Alternative Security Approaches**:

If the IP-based check doesn't meet your security requirements, consider:

1. **Environment-Based Control**: Disable runtime subscription modifications entirely in production via environment variable
2. **API Key Authentication**: Require an API key for subscription modifications
3. **Role-Based Access Control**: Implement user authentication with role-based permissions
4. **Audit Logging**: Log all subscription modification attempts with client details for security monitoring

##### 3. `runtimeSubscriptionUpdated` (Broadcast)

Broadcast event sent to all connected clients when the runtime subscription is successfully updated.

**Direction**: Server → All Clients

**Trigger**: After successful `setRuntimeSubscription` call

**Payload**:

```typescript
RuntimeSubscriptionState
```

**Example**:

```javascript
socket.on('runtimeSubscriptionUpdated', (state) => {
  console.log('Subscription updated by another client:', state);
  // Update UI to reflect new subscription state
});
```

**Example Payload**:

```json
{
  "channels": ["tweets"],
  "users": ["elonmusk"],
  "mode": "active",
  "source": "runtime",
  "updatedAt": "2024-01-15T14:40:55.000Z"
}
```

**Use Cases**:
- Synchronize subscription state across multiple dashboard instances
- Show notifications when subscription changes
- Update UI to reflect current subscription without polling

---

### Frontend UX Pattern: Copying Local Selections to Global Subscription

The dashboard implements a convenient UX pattern for copying local filter selections to the global upstream subscription. This feature uses the existing `setRuntimeSubscription` API without requiring any new backend endpoints.

#### Overview

The "Use selected users" feature allows users to:
1. Select users in the Local Filters section (left sidebar)
2. Copy those selections to the Global Subscription draft with one click
3. Review and adjust the copied selections before applying
4. Apply changes to update the global subscription

**Important**: This is a manual copy operation, not automatic synchronization. Local selections do NOT auto-sync to upstream subscription.

#### Implementation Details

**Frontend Store Method**:

The subscription store provides a `copyFromLocalSelected` method:

```typescript
// In subscription.svelte.ts
copyFromLocalSelected(users: string[]): void {
  // Normalize users (trim, lowercase, unique, sort)
  const normalized = [...new Set(
    users.map(u => u.trim().toLowerCase())
  )].sort();
  
  // Update staged users (draft state)
  this.stagedUsers = normalized;
  // Does NOT trigger network call - only updates draft
}
```

**UI Integration**:

The SubscriptionPanel component integrates with the filters store:

```typescript
// In SubscriptionPanel.svelte
import { filtersStore } from '$lib/stores/filters.svelte';
import { subscriptionStore } from '$lib/stores/subscription.svelte';

function copyFromLocal() {
  // Get selected users from local filters
  const selectedUsers = filtersStore.users;
  
  // Copy to upstream draft
  subscriptionStore.copyFromLocalSelected(selectedUsers);
  
  // Show confirmation
  toastStore.info(`Copied ${selectedUsers.length} users to upstream draft`);
}
```

**Button State**:

```svelte
<button
  onclick={copyFromLocal}
  disabled={filtersStore.users.length === 0}
>
  Use selected users ({filtersStore.users.length})
</button>
```

#### User Workflow

**Step 1: Select Users Locally**
- User selects users in the left sidebar (Local Filters)
- These selections only affect the current dashboard view
- No network calls are made

**Step 2: Copy to Upstream Draft**
- User clicks "Use selected users (N)" button
- Frontend calls `subscriptionStore.copyFromLocalSelected(users)`
- Users are normalized and added to staged state
- No network call yet - changes are in draft

**Step 3: Review and Apply**
- User reviews the copied users in the Subscription Panel
- User can adjust or clear the selections
- User clicks "Apply Changes" to commit
- Frontend calls `socketStore.setRuntimeSubscription(payload)`
- Server updates global subscription
- All connected clients receive `runtimeSubscriptionUpdated` broadcast

#### Example Flow

```javascript
// Step 1: User selects users in local filters
filtersStore.setUsers(['elonmusk', 'vitalikbuterin', 'cz_binance']);

// Step 2: User clicks "Use selected users"
subscriptionStore.copyFromLocalSelected(['elonmusk', 'vitalikbuterin', 'cz_binance']);
// Result: stagedUsers = ['cz_binance', 'elonmusk', 'vitalikbuterin'] (normalized)

// Step 3: User clicks "Apply Changes"
socket.emit('setRuntimeSubscription', {
  channels: subscriptionStore.stagedChannels,
  users: subscriptionStore.stagedUsers
}, (response) => {
  if (response.success) {
    // Server broadcasts runtimeSubscriptionUpdated to all clients
    // All dashboards update their applied state
  }
});
```

#### API Calls

The copy feature uses the existing `setRuntimeSubscription` API:

**Request**:
```json
{
  "channels": ["all"],
  "users": ["cz_binance", "elonmusk", "vitalikbuterin"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "channels": ["all"],
    "users": ["cz_binance", "elonmusk", "vitalikbuterin"],
    "mode": "active",
    "source": "runtime",
    "updatedAt": "2024-01-15T14:45:30.000Z"
  }
}
```

**Broadcast** (to all clients):
```json
{
  "channels": ["all"],
  "users": ["cz_binance", "elonmusk", "vitalikbuterin"],
  "mode": "active",
  "source": "runtime",
  "updatedAt": "2024-01-15T14:45:30.000Z"
}
```

#### Additional Features

**Clear Upstream Users**:

```typescript
// In subscription.svelte.ts
clearUpstreamUsers(): void {
  this.stagedUsers = [];
}
```

```svelte
<button onclick={() => subscriptionStore.clearUpstreamUsers()}>
  Clear upstream users
</button>
```

**Visual Distinction**:

The dashboard clearly separates Local and Global sections:

```
┌─────────────────────────────────────┐
│ Left Sidebar                        │
├─────────────────────────────────────┤
│ Local Filters                       │
│ (Dashboard view only)               │
│ ☑ elonmusk                          │
│ ☑ vitalikbuterin                    │
│ ☐ cz_binance                        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Right Sidebar                       │
├─────────────────────────────────────┤
│ Global Subscription                 │
│ (Affects CLI + Dashboard + Alerts)  │
│                                     │
│ [Use selected users (2)]            │
│ [Clear upstream users]              │
│                                     │
│ Upstream users:                     │
│ elonmusk, vitalikbuterin            │
│                                     │
│ [Apply Changes] [Discard]           │
└─────────────────────────────────────┘
```

#### Design Rationale

**Why Manual Copy?**
- Prevents accidental global changes from local experimentation
- Gives users control over cost-affecting changes
- Allows review and adjustment before applying
- Maintains clear separation between local and global scopes

**Why No Auto-Sync?**
- Local filters are for UI refinement and exploration
- Global subscription affects costs and all outputs
- Users should explicitly opt-in to global changes
- Reduces risk of unintended subscription modifications

**Why Staged-Apply Pattern?**
- Provides preview of changes before committing
- Allows batch modifications (channels + users)
- Supports atomic updates (all or nothing)
- Enables discard/revert functionality

---

## Data Models

### Event Format Overview

The application processes events in two formats:

1. **Actor Event Format**: The raw format received from the Apify actor via WebSocket
2. **Internal Event Format**: The transformed format used within the application

Understanding both formats is essential for debugging and integration.

---

### Actor Event Format (Input from Apify Actor)

This is the raw event structure sent by the crypto-twitter-tracker Apify actor via WebSocket.

**Structure**:

```typescript
interface ActorEvent {
  data: {
    username: string;
    action: string;
    // Event-specific fields (see below)
  };
  event_type: string;
}
```

#### Actor Post Event (post_created)

```typescript
{
  data: {
    username: "elonmusk",
    action: "post_created",
    tweetId: "1234567890",
    tweet: {
      id: "1234567890",
      type: "tweet",
      created_at: "2024-01-15T14:30:22.000Z",
      body: {
        text: "Bitcoin is the future of money",
        urls: [
          { name: "Bitcoin", url: "https://bitcoin.org", tco: "https://t.co/abc" }
        ],
        mentions: ["@satoshi"]
      },
      author: {
        handle: "elonmusk",
        id: "44196397",
        verified: true,
        profile: {
          name: "Elon Musk",
          avatar: "https://...",
          bio: "Tesla, SpaceX, etc."
        }
      },
      metrics: {
        likes: 15000,
        retweets: 3000,
        replies: 500,
        views: 1000000
      },
      media: {
        images: ["https://..."],
        videos: []
      }
    }
  },
  event_type: "post_created"
}
```

#### Actor Follow Event (follow_created)

```typescript
{
  data: {
    username: "elonmusk",
    action: "follow_created",
    user: {
      id: "44196397",
      handle: "elonmusk",
      verified: true,
      profile: {
        name: "Elon Musk",
        avatar: "https://...",
        bio: "Tesla, SpaceX, etc."
      },
      metrics: {
        followers: 150000000,
        following: 500
      }
    },
    following: {
      id: "123456",
      handle: "vitalikbuterin",
      verified: true,
      profile: {
        name: "Vitalik Buterin",
        avatar: "https://...",
        bio: "Ethereum founder"
      },
      metrics: {
        followers: 5000000,
        following: 200
      }
    }
  },
  event_type: "follow_created"
}
```

#### Actor Profile Event (user_updated, profile_updated, profile_pinned)

```typescript
{
  data: {
    username: "elonmusk",
    action: "profile_updated",
    user: {
      id: "44196397",
      handle: "elonmusk",
      verified: true,
      profile: {
        name: "Elon Musk",
        avatar: "https://...",
        bio: "Updated bio text",
        location: "Mars",
        website: "https://tesla.com"
      },
      metrics: {
        followers: 150000000,
        following: 500
      }
    },
    // For pin_update action only
    pinned: [
      {
        id: "1234567890",
        type: "tweet",
        body: { text: "Pinned tweet text" },
        created_at: "2024-01-15T14:30:22.000Z"
      }
    ]
  },
  event_type: "profile_updated"
}
```

---

### Internal Event Format (After Transformation)

After the WSSClient transforms actor events, they use this internal format throughout the application.

**Structure**:

```typescript
interface TwitterEvent {
  type: EventType;
  timestamp: string;  // ISO 8601 format
  primaryId: string;  // Tweet ID, User ID, or generated ID
  user: {
    username: string;
    displayName: string;
    userId: string;
  };
  data: PostData | FollowingData | ProfileData;
}
```

#### Internal Post Event

```typescript
{
  type: "post_created",
  timestamp: "2024-01-15T14:30:22.000Z",
  primaryId: "1234567890",
  user: {
    username: "elonmusk",
    displayName: "Elon Musk",
    userId: "44196397"
  },
  data: {
    // Complete actor data preserved here
    username: "elonmusk",
    action: "post_created",
    tweetId: "1234567890",
    tweet: {
      id: "1234567890",
      type: "tweet",
      created_at: "2024-01-15T14:30:22.000Z",
      body: {
        text: "Bitcoin is the future of money",
        urls: [...],
        mentions: [...]
      },
      author: { ... },
      metrics: { ... },
      media: { ... }
    }
  }
}
```

#### Internal Follow Event

```typescript
{
  type: "follow_created",
  timestamp: "2024-01-15T14:30:22.000Z",
  primaryId: "123456",
  user: {
    username: "elonmusk",
    displayName: "Elon Musk",
    userId: "44196397"
  },
  data: {
    // Complete actor data preserved here
    username: "elonmusk",
    action: "follow_created",
    user: {
      id: "44196397",
      handle: "elonmusk",
      profile: { ... },
      metrics: { ... }
    },
    following: {
      id: "123456",
      handle: "vitalikbuterin",
      profile: { ... },
      metrics: { ... }
    }
  }
}
```

#### Internal Profile Event

```typescript
{
  type: "profile_updated",
  timestamp: "2024-01-15T14:30:22.000Z",
  primaryId: "44196397",
  user: {
    username: "elonmusk",
    displayName: "Elon Musk",
    userId: "44196397"
  },
  data: {
    // Complete actor data preserved here
    username: "elonmusk",
    action: "profile_updated",
    user: {
      id: "44196397",
      handle: "elonmusk",
      profile: { ... },
      metrics: { ... }
    },
    pinned: [ ... ]  // Only for pin_update action
  }
}
```

---

### Type Definitions

#### PostData

Data structure for post/tweet events. Contains the complete actor data including nested tweet structure.

```typescript
interface PostData {
  tweetId: string;
  username: string;
  action: string;
  tweet?: {
    id: string;
    type: string;
    created_at: string;
    body: {
      text: string;
      urls?: Array<{ name: string; url: string; tco: string }>;
      mentions?: string[];
    };
    author: {
      handle: string;
      id?: string;
      verified?: boolean;
      profile?: {
        name: string;
        avatar?: string;
        bio?: string;
      };
    };
    metrics?: {
      likes?: number;
      retweets?: number;
      replies?: number;
      views?: number;
    };
    media?: {
      images?: string[];
      videos?: string[];
    };
    subtweet?: any;
  };
}
```

**Key Fields**:
- `tweetId`: Unique identifier for the tweet
- `username`: Author's Twitter username
- `action`: Event action type (e.g., "post_created")
- `tweet.body.text`: The actual tweet text content
- `tweet.author`: Complete author information
- `tweet.metrics`: Engagement metrics (likes, retweets, etc.)

**Usage Example**:
```typescript
// Extract tweet text from PostData
const tweetText = (event.data as PostData).tweet?.body?.text || 'No text';

// Extract author username
const authorHandle = (event.data as PostData).tweet?.author?.handle || 'unknown';
```

#### FollowingData

Data structure for follow/unfollow events. Contains both the user and the target they followed.

```typescript
interface FollowingData {
  username: string;
  action: string;
  user?: {
    id: string;
    handle: string;
    verified?: boolean;
    profile?: {
      name: string;
      avatar?: string;
      bio?: string;
      location?: string;
      website?: string;
    };
    metrics?: {
      followers?: number;
      following?: number;
    };
  };
  following?: {
    id: string;
    handle: string;
    verified?: boolean;
    profile?: {
      name: string;
      avatar?: string;
      bio?: string;
      location?: string;
      website?: string;
    };
    metrics?: {
      followers?: number;
      following?: number;
    };
  };
}
```

**Key Fields**:
- `username`: The user who performed the follow action
- `action`: Event action type (e.g., "follow_created", "follow_updated")
- `user`: Complete profile of the user who followed
- `following`: Complete profile of the target user being followed

**Usage Example**:
```typescript
// Extract target username from FollowingData
const targetHandle = (event.data as FollowingData).following?.handle || 'unknown';

// Extract follower username
const followerHandle = (event.data as FollowingData).user?.handle || 'unknown';
```

#### ProfileData

Data structure for profile update events. Supports multiple change types including profile updates and pinned tweets.

```typescript
interface ProfileData {
  username: string;
  action: string;
  user?: {
    id: string;
    handle: string;
    verified?: boolean;
    profile?: {
      name: string;
      avatar?: string;
      bio?: string;
      location?: string;
      website?: string;
      banner?: string;
    };
    metrics?: {
      followers?: number;
      following?: number;
    };
  };
  pinned?: Array<{
    id: string;
    type: string;
    created_at: string;
    body: {
      text: string;
      urls?: Array<{ name: string; url: string; tco: string }>;
      mentions?: string[];
    };
    author?: {
      handle: string;
      id?: string;
    };
    metrics?: {
      likes?: number;
      retweets?: number;
      replies?: number;
      views?: number;
    };
  }>;
}
```

**Key Fields**:
- `username`: The user whose profile was updated
- `action`: Event action type (e.g., "profile_updated", "pin_update", "user_updated")
- `user`: Complete updated profile information
- `pinned`: Array of pinned tweets (only present for pin_update action)

**Usage Example**:
```typescript
// Check for pinned tweets
const hasPinnedTweets = (event.data as ProfileData).pinned && 
                        (event.data as ProfileData).pinned!.length > 0;

// Extract action type
const actionType = (event.data as ProfileData).action || 'updated';
```

---

### TwitterEvent

The core event model used throughout the application after transformation from actor format.

```typescript
type EventType = 'post_created' | 'post_updated' | 'follow_created' | 'follow_updated' | 
                 'user_updated' | 'profile_updated' | 'profile_pinned';

interface TwitterEvent {
  type: EventType;
  timestamp: string;  // ISO 8601 format
  primaryId: string;  // Tweet ID, User ID, or generated ID
  user: {
    username: string;
    displayName: string;
    userId: string;
  };
  data: PostData | ProfileData | FollowingData;
}
```

**Transformation Process**:

1. Actor sends event in actor format via WebSocket
2. WSSClient.transformEvent() converts to internal format
3. Complete actor data is preserved in the `data` field (deep copy)
4. User information is extracted and normalized in the `user` field
5. Event type is preserved from actor's `event_type`
6. Primary ID is extracted based on event type (tweetId, userId, etc.)

---

### PostData

Data for `post_created` and `post_updated` events. This is the complete actor data structure preserved after transformation.

```typescript
interface PostData {
  tweetId: string;
  username: string;
  action: string;
  tweet?: {
    id: string;
    type: string;
    created_at: string;
    body: {
      text: string;
      urls?: Array<{ name: string; url: string; tco: string }>;
      mentions?: string[];
    };
    author: {
      handle: string;
      id?: string;
      verified?: boolean;
      profile?: {
        name: string;
        avatar?: string;
        bio?: string;
      };
    };
    metrics?: {
      likes?: number;
      retweets?: number;
      replies?: number;
      views?: number;
    };
    media?: {
      images?: string[];
      videos?: string[];
    };
    subtweet?: any;
  };
}
```

**Note**: All fields from the actor event are preserved. Optional fields (marked with `?`) may not be present in all events.

---

### ProfileData

Data for `user_updated`, `profile_updated`, and `profile_pinned` events.

```typescript
interface ProfileData {
  username: string;
  action: string;
  user?: {
    id: string;
    handle: string;
    verified?: boolean;
    profile?: {
      name: string;
      avatar?: string;
      bio?: string;
      location?: string;
      website?: string;
      banner?: string;
    };
    metrics?: {
      followers?: number;
      following?: number;
    };
  };
  pinned?: Array<{
    id: string;
    type: string;
    created_at: string;
    body: {
      text: string;
      urls?: Array<{ name: string; url: string; tco: string }>;
      mentions?: string[];
    };
    author?: {
      handle: string;
      id?: string;
    };
    metrics?: {
      likes?: number;
      retweets?: number;
      replies?: number;
      views?: number;
    };
  }>;
}
```

**Note**: The `pinned` array is only present for `pin_update` action events.

---

### FollowingData

Data for `follow_created` and `follow_updated` (unfollow) events.

```typescript
interface FollowingData {
  username: string;
  action: string;
  user?: {
    id: string;
    handle: string;
    verified?: boolean;
    profile?: {
      name: string;
      avatar?: string;
      bio?: string;
      location?: string;
      website?: string;
    };
    metrics?: {
      followers?: number;
      following?: number;
    };
  };
  following?: {
    id: string;
    handle: string;
    verified?: boolean;
    profile?: {
      name: string;
      avatar?: string;
      bio?: string;
      location?: string;
      website?: string;
    };
    metrics?: {
      followers?: number;
      following?: number;
    };
  };
}
```

**Note**: Both `user` (the follower) and `following` (the target) contain complete profile information.

---

### EventStats

Statistics about processed events.

```typescript
interface EventStats {
  total: number;
  delivered: number;
  deduped: number;
  byType: Record<EventType, number>;
  rate: number;  // Events per minute
  startTime: Date;
  lastEventTime: Date;
}
```

### HealthStatus

Complete health status returned by `/status` endpoint.

```typescript
interface HealthStatus {
  connection: {
    status: 'connected' | 'disconnected' | 'reconnecting';
    channels: string[];
    uptime: number;  // seconds
  };
  events: {
    total: number;
    delivered: number;
    deduped: number;
    rate: number;  // events per second
  };
  alerts: {
    telegram: { sent: number; failed: number };
    discord: { sent: number; failed: number };
    webhook: { sent: number; failed: number };
  };
  filters: {
    users: string[];
    keywords: string[];
  };
}
```

---

## Rate Limiting

### Alert Channels

All alert channels (Telegram, Discord, Webhook) are rate-limited to **10 messages per minute** per channel to prevent spam and API abuse.

When the rate limit is exceeded:
- Excess alerts are dropped (not queued)
- A warning is logged
- The rate limiter resets after 60 seconds

### WebSocket Events

WebSocket events are not rate-limited. All events are broadcast to all connected clients in real-time.

---

## Error Handling

### HTTP Endpoints

**Status Endpoint**:
- Returns `500 Internal Server Error` if status collection fails
- Always returns valid JSON (empty object on error)

### WebSocket

**Connection Errors**:
- Clients automatically reconnect using Socket.io's built-in reconnection logic
- Server logs disconnections but continues serving other clients

**Event Broadcast Errors**:
- Failed broadcasts to individual clients don't affect other clients
- Errors are logged but don't stop event processing

---

## Security Considerations

### Authentication

Currently, the application does not implement authentication for local development use. For production deployments:

- Consider adding API key authentication for `/status` endpoint
- Implement WebSocket authentication tokens
- Use HTTPS/WSS for encrypted communication
- Restrict access via firewall rules

### Token Security

- The Apify token is never exposed via API endpoints
- Logs are sanitized to remove tokens
- Tokens should only be set via environment variables

### CORS

The dashboard server allows all origins by default for local development. For production:

- Configure CORS to allow only trusted origins
- Use environment variables to specify allowed origins

---

## Troubleshooting Event Processing

This section covers common issues related to event processing, data transformation, and debugging techniques.

### Missing Event Data in Output

**Problem**: Events are received but CLI output or dashboard doesn't show complete information (e.g., missing tweet text, user information, or profile changes).

**Symptoms**:
- CLI shows `[post_created] @username: No text available`
- Dashboard displays events with empty or incomplete data
- Profile updates show generic messages instead of specific changes

**Root Causes**:
1. Event transformation not preserving complete data structure
2. Output formatters accessing incorrect data paths
3. Actor sending events in unexpected format

**Diagnostic Steps**:

1. **Enable Debug Mode** to see raw and transformed events:
   ```bash
   DEBUG=true npm start
   ```

2. **Check Raw Actor Events**: Look for log entries like:
   ```
   [WSSClient] Raw actor event: {
     "data": {
       "username": "elonmusk",
       "tweet": { "body": { "text": "..." } }
     },
     "event_type": "post_created"
   }
   ```
   Verify the actor is sending complete data.

3. **Check Transformed Events**: Look for log entries like:
   ```
   [WSSClient] Transformed event: {
     "type": "post_created",
     "user": { "username": "elonmusk" },
     "data": { ... }
   }
   ```
   Verify the `data` field contains the complete actor data structure.

4. **Verify Data Paths**: Check that output formatters are accessing the correct nested paths:
   - Tweet text: `event.data.tweet?.body?.text`
   - Follow target: `event.data.following?.handle`
   - Profile info: `event.data.user?.profile`

**Solutions**:

1. **If raw actor events are incomplete**: The issue is with the actor, not the client. Contact actor maintainer.

2. **If transformation loses data**: Check WSSClient.transformEvent():
   ```typescript
   // Should use deep copy
   data: JSON.parse(JSON.stringify(eventData))
   ```

3. **If output formatters can't access data**: Update extraction paths to match actor format:
   ```typescript
   // Correct path for tweet text
   const text = (event.data as any).tweet?.body?.text || 'No text available';
   ```

**Example Debug Output**:

```
[WSSClient] Raw actor event: {
  "data": {
    "username": "elonmusk",
    "action": "post_created",
    "tweetId": "123",
    "tweet": {
      "body": { "text": "Hello world" },
      "author": { "handle": "elonmusk" }
    }
  },
  "event_type": "post_created"
}

[WSSClient] Transformed event: {
  "type": "post_created",
  "timestamp": "2024-01-15T14:30:22.000Z",
  "primaryId": "123",
  "user": {
    "username": "elonmusk",
    "displayName": "Elon Musk",
    "userId": "44196397"
  },
  "data": {
    "username": "elonmusk",
    "action": "post_created",
    "tweetId": "123",
    "tweet": {
      "body": { "text": "Hello world" },
      "author": { "handle": "elonmusk" }
    }
  }
}
```

---

### Events Being Rejected (Validation Failures)

**Problem**: Events are received from the actor but are not appearing in any output channels.

**Symptoms**:
- Connection status shows "connected"
- No events in CLI, dashboard, or alerts
- Debug logs show validation failures

**Root Causes**:
1. Events don't match expected internal format
2. Required fields are missing after transformation
3. Validation logic is too strict

**Diagnostic Steps**:

1. **Enable Debug Mode**:
   ```bash
   DEBUG=true npm start
   ```

2. **Look for Validation Failure Logs**:
   ```
   [StreamCore] Validation failed: missing event type
   [StreamCore] Event: { ... }
   ```

3. **Check Event Structure**: Verify the event has required fields:
   - `type` (string)
   - `user.username` (string)
   - `data` (object)

4. **Check for Transformation Errors**:
   ```
   [WSSClient] Transformation error: ...
   ```

**Solutions**:

1. **If validation rejects valid events**: Update StreamCore.isValidEvent() to accept internal format:
   ```typescript
   const hasInternalFormat = event.user && 
                            typeof event.user === 'object' &&
                            typeof event.user.username === 'string' &&
                            event.data &&
                            typeof event.data === 'object';
   ```

2. **If transformation fails**: Check WSSClient.transformEvent() for errors:
   - Verify username extraction logic
   - Verify event type mapping
   - Verify data preservation

3. **If required fields are missing**: Check actor event format matches expectations.

**Example Debug Output**:

```
[StreamCore] Validation failed: missing required fields
[StreamCore] Event: {
  "type": "post_created",
  "timestamp": "2024-01-15T14:30:22.000Z",
  "primaryId": "123",
  "data": { ... }
  // Missing "user" field!
}
```

---

### Data Corruption or Modification

**Problem**: Event data appears corrupted or modified after transformation.

**Symptoms**:
- Nested objects are missing fields
- Arrays are empty when they shouldn't be
- Data values are different from actor events

**Root Causes**:
1. Shallow copy instead of deep copy during transformation
2. Mutation of original event data
3. Incorrect field extraction logic

**Diagnostic Steps**:

1. **Enable Debug Mode** and compare raw vs transformed events:
   ```bash
   DEBUG=true npm start
   ```

2. **Check for Reference Issues**: If modifying the original actor event affects the transformed event, it's a shallow copy issue.

3. **Verify Deep Copy**: Check WSSClient.transformEvent():
   ```typescript
   // Should be deep copy
   data: JSON.parse(JSON.stringify(eventData))
   
   // NOT shallow copy
   data: eventData  // ❌ Wrong!
   data: { ...eventData }  // ❌ Still wrong (shallow)!
   ```

**Solutions**:

1. **Use Deep Copy**: Always use `JSON.parse(JSON.stringify())` for complete data preservation:
   ```typescript
   const transformedEvent: TwitterEvent = {
     type: eventType,
     timestamp: new Date().toISOString(),
     primaryId: primaryId,
     user: { ... },
     data: JSON.parse(JSON.stringify(eventData))  // Deep copy
   };
   ```

2. **Avoid Mutation**: Never modify the original actor event data.

3. **Test Independence**: Verify that modifying the original event doesn't affect the transformed event.

---

### Performance Issues with Debug Mode

**Problem**: Application becomes slow or unresponsive when debug mode is enabled.

**Symptoms**:
- High CPU usage
- Slow event processing
- Large log files
- Memory consumption increases

**Root Causes**:
1. Debug logging is very verbose
2. JSON.stringify() is expensive for large objects
3. Logging every event creates I/O overhead

**Solutions**:

1. **Use Debug Mode Sparingly**: Only enable when actively troubleshooting:
   ```bash
   # Enable temporarily
   DEBUG=true npm start
   
   # Disable after troubleshooting
   npm start
   ```

2. **Filter Events**: Reduce log volume by filtering to specific users:
   ```env
   DEBUG=true
   USERS=elonmusk  # Only log events from one user
   ```

3. **Redirect to File**: Avoid terminal I/O overhead:
   ```bash
   DEBUG=true npm start > debug.log 2>&1
   ```

4. **Use Conditional Logging**: Ensure debug logs are guarded:
   ```typescript
   if (process.env.DEBUG === 'true') {
     console.debug('[Component] Data:', JSON.stringify(data, null, 2));
   }
   ```

---

### Understanding Debug Log Output

Debug mode provides detailed visibility into the event processing pipeline. Here's how to interpret the logs:

#### 1. Raw Actor Event Logs

```
[WSSClient] Raw actor event: {
  "data": {
    "username": "elonmusk",
    "action": "post_created",
    "tweetId": "123456789",
    "tweet": {
      "body": { "text": "Bitcoin is the future" },
      "author": { "handle": "elonmusk", "id": "44196397" }
    }
  },
  "event_type": "post_created"
}
```

**What to check**:
- Is the `data` object complete?
- Does it contain all expected nested fields?
- Is the `event_type` correct?
- Is the username present in the expected location?

#### 2. Transformed Event Logs

```
[WSSClient] Transformed event: {
  "type": "post_created",
  "timestamp": "2024-01-15T14:30:22.000Z",
  "primaryId": "123456789",
  "user": {
    "username": "elonmusk",
    "displayName": "Elon Musk",
    "userId": "44196397"
  },
  "data": {
    "username": "elonmusk",
    "action": "post_created",
    "tweetId": "123456789",
    "tweet": { ... }
  }
}
```

**What to check**:
- Is the `type` field correct?
- Is the `user` object populated correctly?
- Is the `data` field a complete copy of the actor's `data` object?
- Is the `primaryId` extracted correctly?

#### 3. Validation Logs

```
[StreamCore] Event validated successfully
```

or

```
[StreamCore] Validation failed: missing event type
[StreamCore] Event: { ... }
```

**What to check**:
- If validation fails, which field is missing?
- Does the event structure match the internal format?
- Are required fields present?

#### 4. Error Logs

```
[WSSClient] Transformation error: Cannot read property 'handle' of undefined
[WSSClient] Problematic data: { ... }
```

**What to check**:
- Which field access caused the error?
- Is the actor event structure different than expected?
- Are optional chaining operators (`?.`) being used?

---

### Common Debug Scenarios

#### Scenario 1: Tweet Text Not Appearing

**Debug Output**:
```
[WSSClient] Raw actor event: {
  "data": {
    "tweet": { "body": { "text": "Hello world" } }
  }
}

[WSSClient] Transformed event: {
  "data": {
    "tweet": { "body": { "text": "Hello world" } }
  }
}

[CLIOutput] Formatted: [post_created] @elonmusk: No text available
```

**Diagnosis**: The data is preserved correctly, but CLIOutput is accessing the wrong path.

**Solution**: Update CLIOutput.formatEvent() to use correct path:
```typescript
const tweetText = (event.data as any).tweet?.body?.text || 'No text available';
```

#### Scenario 2: Events Being Rejected

**Debug Output**:
```
[WSSClient] Transformed event: {
  "type": "post_created",
  "data": { ... }
  // Missing "user" field
}

[StreamCore] Validation failed: missing required fields
```

**Diagnosis**: Transformation is not extracting user information correctly.

**Solution**: Update WSSClient.transformEvent() to extract username:
```typescript
const username = eventData.username || 
                 eventData.user?.handle || 
                 eventData.tweet?.author?.handle || 
                 'unknown';
```

#### Scenario 3: Data Corruption

**Debug Output**:
```
[WSSClient] Raw actor event: {
  "data": {
    "tweet": {
      "body": { "text": "Hello" },
      "metrics": { "likes": 100 }
    }
  }
}

[WSSClient] Transformed event: {
  "data": {
    "tweet": {
      "body": { "text": "Hello" }
      // metrics missing!
    }
  }
}
```

**Diagnosis**: Shallow copy is not preserving nested objects.

**Solution**: Use deep copy in transformation:
```typescript
data: JSON.parse(JSON.stringify(eventData))
```

---

### Best Practices for Debugging

1. **Always start with debug mode** when investigating event processing issues
2. **Compare raw and transformed events** to identify where data is lost
3. **Check validation logs** to understand why events are rejected
4. **Use filters** to reduce log volume when debugging specific users
5. **Redirect logs to file** for easier analysis
6. **Disable debug mode** after troubleshooting to restore performance

---

## Examples

### Monitoring Script

Monitor application health with a simple bash script:

```bash
#!/bin/bash
while true; do
  curl -s http://localhost:3001/status | jq '.events'
  sleep 10
done
```

### Dashboard Client

Minimal HTML/JavaScript client:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Event Monitor</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <div id="events"></div>
  <script>
    const socket = io('http://localhost:3000');
    
    socket.on('event', (event) => {
      const div = document.createElement('div');
      div.textContent = `[${event.type}] @${event.user.username}: ${JSON.stringify(event.data)}`;
      document.getElementById('events').appendChild(div);
    });
    
    socket.on('stats', (stats) => {
      console.log('Stats:', stats);
    });
  </script>
</body>
</html>
```

### Webhook Integration

Example webhook receiver (Express):

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const event = req.body;
  console.log('Received event:', event);
  
  // Process event
  // ...
  
  res.status(200).send('OK');
});

app.listen(8080, () => {
  console.log('Webhook receiver listening on port 8080');
});
```

---

For more information, see:
- [README.md](../README.md) - General documentation
- [CONFIGURATION.md](CONFIGURATION.md) - Configuration guide