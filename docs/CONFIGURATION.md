# Configuration Guide

This guide provides comprehensive documentation for all configuration options in the Crypto Twitter Alpha Stream application.

## Table of Contents

- [Configuration Methods](#configuration-methods)
- [Configuration Priority](#configuration-priority)
- [Required Configuration](#required-configuration)
- [Migration from SSE to WebSocket](#migration-from-sse-to-websocket)
- [Environment Variables](#environment-variables)
- [JSON Configuration File](#json-configuration-file)
- [Configuration Examples](#configuration-examples)
- [Advanced Configuration](#advanced-configuration)
- [Best Practices](#best-practices)

---

## Configuration Methods

The application supports three configuration methods:

1. **Environment Variables** - Set via `.env` file or system environment
2. **JSON Configuration File** - `config/config.json`
3. **Default Values** - Built-in fallback values

### Configuration Priority

When the same setting is defined in multiple places, the following priority order applies:

```
Environment Variables > config.json > Default Values
```

**Example**: If `DASHBOARD_PORT` is set to `4000` in `.env` and `3000` in `config.json`, the application will use `4000`.

---

## Required Configuration

Two configuration values are required:

### APIFY_TOKEN

Your Apify API authentication token.

**Required**: Yes  
**Type**: String  
**Source**: Environment variable only (for security)  
**Example**: `APIFY_TOKEN=apify_api_AbCdEfGhIjKlMnOpQrStUvWxYz`

**How to get your token**:
1. Log in to [Apify Console](https://console.apify.com/settings/integrations?fpr=muh)
2. Navigate to Settings → Integrations (or use the direct link above)
3. Copy your API token

**Security Note**: Never commit your token to version control. Always use environment variables.

### APIFY_ACTOR_URL

The URL of the deployed Apify Standby Actor.

**Required**: Yes  
**Type**: String (URL)  
**Source**: Environment variable  
**Example**: `APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor`

The base URL of the crypto-twitter-tracker actor that provides the WebSocket stream. Supports http/https/ws/wss formats - automatically converted to the appropriate protocol.

**Important**: This configuration is mandatory. The application will fail to start without it.

---

## Migration from SSE to WebSocket

The application has migrated from Server-Sent Events (SSE) to WebSocket (WSS) for improved real-time communication. This section helps you migrate your configuration.

### What Changed

**Protocol**: SSE → WebSocket
- Old: Unidirectional HTTP-based streaming
- New: Bidirectional WebSocket connection with subscribe protocol

**Configuration**:
- `ENDPOINT` → `CHANNELS` (now supports multiple channels)
- URL format now supports ws/wss in addition to http/https

**Connection Flow**:
- Old: HTTP GET request to SSE endpoint
- New: WebSocket connection + subscribe message

### Migration Steps

1. **Update Environment Variable**:
   ```env
   # Old (SSE)
   ENDPOINT=all
   
   # New (WebSocket)
   CHANNELS=all
   ```

2. **Multiple Channels** (new feature):
   ```env
   # You can now subscribe to multiple channels
   CHANNELS=tweets,following
   ```

3. **URL Format** (optional):
   ```env
   # All formats work - automatically converted
   APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor  # Converted to wss://
   APIFY_ACTOR_URL=wss://muhammetakkurtt--crypto-twitter-tracker.apify.actor    # Used as-is
   ```

4. **Update config.json** (if using):
   ```json
   {
     "apify": {
       "channels": ["all"]  // Changed from "endpoint": "all"
     }
   }
   ```

### Backward Compatibility

The migration maintains backward compatibility for all user-facing behavior:
- Event format remains unchanged
- Filtering works identically
- Output channels work identically
- All configuration options (except ENDPOINT→CHANNELS) remain the same

### New Features

**Multiple Channel Subscription**:
```env
# Subscribe to multiple event types simultaneously
CHANNELS=tweets,following,profile
```

**Improved Reconnection**:
- WebSocket protocol-level ping/pong for connection health
- Automatic reconnection with exponential backoff
- Graceful shutdown handling (5 second delay before reconnect)

**URL Flexibility**:
- Accepts http/https/ws/wss formats
- Automatically converts to appropriate protocol
- Same base URL works for WebSocket and REST endpoints

### Troubleshooting Migration

**Problem**: "ENDPOINT environment variable not recognized"

**Solution**: Change `ENDPOINT` to `CHANNELS` in your `.env` file

**Problem**: "Invalid channels configuration"

**Solution**: Ensure channels is comma-separated: `CHANNELS=tweets,following`

**Problem**: "Connection fails with new configuration"

**Solution**: 
- Verify your token is still valid
- Check that the actor URL is correct
- Try with `CHANNELS=all` first to test connection

### Channel Normalization Behavior

The application automatically normalizes channel configurations to align with the tracker server's protocol semantics. This ensures consistent behavior between client and server.

#### Normalization Rules

1. **Empty Channels Array**: When no channels are specified (empty array), the application normalizes it to `["all"]`
   ```env
   # These are equivalent:
   CHANNELS=
   CHANNELS=all
   ```

2. **"all" Channel Dominance**: When "all" is present with other channels, the application normalizes to `["all"]` only
   ```env
   # These are all equivalent:
   CHANNELS=all
   CHANNELS=all,tweets
   CHANNELS=tweets,all,following
   # All normalize to: ["all"]
   ```

3. **Multiple Specific Channels**: When multiple specific channels are provided without "all", they remain unchanged
   ```env
   CHANNELS=tweets,following
   # Remains: ["tweets", "following"]
   ```

#### Why Normalization Happens

The tracker server treats "all" as a special channel that includes all event types. When "all" is present, subscribing to additional specific channels is redundant. The normalization ensures:

- **Protocol Alignment**: Client behavior matches server semantics
- **Efficiency**: Avoids redundant subscriptions
- **Clarity**: Makes the actual subscription explicit

#### Normalization Examples

| Configuration | Normalized To | Explanation |
|--------------|---------------|-------------|
| `CHANNELS=` | `["all"]` | Empty defaults to all events |
| `CHANNELS=all` | `["all"]` | Already normalized |
| `CHANNELS=tweets` | `["tweets"]` | Single specific channel |
| `CHANNELS=tweets,following` | `["tweets", "following"]` | Multiple specific channels |
| `CHANNELS=all,tweets` | `["all"]` | "all" dominates |
| `CHANNELS=tweets,all,profile` | `["all"]` | "all" dominates |

#### Validation Behavior

The application validates channels configuration during startup:

- **Empty array**: Accepted (normalizes to `["all"]`)
- **Valid channels**: Accepted (normalized if needed)
- **Invalid channels**: Rejected with error message

**Example Startup Log**:
```
✓ Configuration validated successfully
  Channels: ["all"] (normalized from ["all", "tweets"])
```

#### Best Practices

1. **Use "all" for comprehensive monitoring**: If you want all event types, just use `CHANNELS=all`

2. **Use specific channels for targeted monitoring**: If you only need tweets, use `CHANNELS=tweets`

3. **Don't mix "all" with specific channels**: The application will normalize it to `["all"]` anyway

4. **Leave empty for default behavior**: Empty channels configuration defaults to `["all"]`

---

## Environment Variables

All environment variables can be set in a `.env` file in the project root. See `.env.example` for a complete template.

### Apify Configuration

#### APIFY_TOKEN

**Required**: Yes  
**Type**: String  
**Default**: None  
**Example**: `APIFY_TOKEN=apify_api_AbCdEfGhIjKlMnOpQrStUvWxYz`

Your Apify API token for authentication.

#### APIFY_ACTOR_URL

**Required**: Yes  
**Type**: String (URL)  
**Source**: Environment variable  
**Example**: `APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor`

The base URL of the deployed Apify Standby Actor that provides the WebSocket stream. Supports http/https/ws/wss formats - automatically converted to the appropriate protocol.

**Important**: This configuration is mandatory. The application will fail to start without it.

**URL Format Flexibility**:
- `http://host` → Converted to `ws://host` for WebSocket
- `https://host` → Converted to `wss://host` for WebSocket
- `ws://host` → Used as-is for WebSocket
- `wss://host` → Used as-is for WebSocket

**Actor Page**: [https://apify.com/muhammetakkurtt/crypto-twitter-tracker?fpr=muh](https://apify.com/muhammetakkurtt/crypto-twitter-tracker?fpr=muh)

#### Protocol Handling and Automatic Detection

The application automatically handles protocol conversion between HTTP/HTTPS and WebSocket (WS/WSS) protocols. This allows you to use any URL format, and the application will convert it to the appropriate protocol for each use case.

**How It Works**:

1. **WebSocket Connections**: The application converts HTTP/HTTPS URLs to WS/WSS for WebSocket connections
   - `http://host` → `ws://host` (WebSocket connection)
   - `https://host` → `wss://host` (WebSocket connection)
   - `ws://host` → `ws://host` (used as-is)
   - `wss://host` → `wss://host` (used as-is)

2. **REST Endpoints**: The application converts WS/WSS URLs to HTTP/HTTPS for REST API calls (like `/active-users`)
   - `ws://host` → `http://host` (REST endpoint)
   - `wss://host` → `https://host` (REST endpoint)
   - `http://host` → `http://host` (used as-is)
   - `https://host` → `https://host` (used as-is)

**Protocol Selection for REST Endpoints**:

When making HTTP requests to REST endpoints (like `/active-users`), the application automatically selects the correct HTTP client based on the converted URL protocol:

- **HTTP URLs** (`http://`): Uses Node.js `http` module
- **HTTPS URLs** (`https://`): Uses Node.js `https` module

This ensures that both HTTP and HTTPS endpoints work correctly without manual configuration.

**Examples**:

| Base URL Configuration | WebSocket Connection | REST Endpoint | HTTP Client |
|------------------------|---------------------|---------------|-------------|
| `http://localhost:8080` | `ws://localhost:8080` | `http://localhost:8080/active-users` | `http` |
| `https://example.com` | `wss://example.com` | `https://example.com/active-users` | `https` |
| `ws://localhost:8080` | `ws://localhost:8080` | `http://localhost:8080/active-users` | `http` |
| `wss://example.com` | `wss://example.com` | `https://example.com/active-users` | `https` |

**Why This Matters**:

- **Flexibility**: You can use any URL format in your configuration
- **Consistency**: The same base URL works for both WebSocket and REST endpoints
- **Security**: HTTPS/WSS URLs automatically use secure connections
- **Development**: Use `http://localhost` for local development without SSL certificates
- **Production**: Use `https://` URLs for production deployments with SSL

**Configuration Examples**:

```env
# Local development (HTTP)
APIFY_ACTOR_URL=http://localhost:8080

# Production (HTTPS)
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor

# Explicit WebSocket (WS)
APIFY_ACTOR_URL=ws://localhost:8080

# Explicit WebSocket Secure (WSS)
APIFY_ACTOR_URL=wss://muhammetakkurtt--crypto-twitter-tracker.apify.actor
```

All of these configurations work correctly - the application handles protocol conversion automatically.

#### CHANNELS

**Required**: No  
**Type**: Comma-separated string  
**Default**: `all`  
**Options**: `all`, `tweets`, `following`, `profile`  
**Example**: `CHANNELS=tweets,following`

Selects which channels to subscribe to via WebSocket. You can subscribe to multiple channels simultaneously.

**Available Channels**:
- `all` - All Twitter events (posts, profile updates, following changes)
- `tweets` - Only new tweet/post events
- `following` - Only following/unfollowing events
- `profile` - Only profile update events

**Multiple Channels**: Specify multiple channels separated by commas:
```env
CHANNELS=tweets,following
```

This will subscribe to both tweets and following events simultaneously.

---

### Event Filters

#### USERS

**Required**: No  
**Type**: Comma-separated string  
**Default**: Empty (all users)  
**Example**: `USERS=elonmusk,vitalikbuterin,cz_binance`

Filter events to only include specific Twitter usernames. This enables both actor-side and client-side filtering for cost optimization.

**How It Works - Two-Layer Filtering**:

1. **Actor-Side Filtering (Layer 1)**: When you configure `USERS`, the application includes them in the WebSocket subscribe message. The actor filters events at the source and only delivers events from your specified users. This significantly reduces costs because you're only charged for events actually delivered to your client.

2. **Client-Side Filtering (Layer 2)**: After events are received, the application applies additional client-side filters (if configured). This provides extra refinement but doesn't affect costs since events are already delivered.

**Cost Implications**:

The Apify actor charges per event per client. User filtering allows you to control which events are delivered to your client. Without user filtering, you receive events from all monitored accounts. With user filtering, you only receive events from your specified users, which can reduce the number of events delivered.

**Examples**:
- No filter: Receives events from all monitored accounts
- 3 users: Receives events only from those 3 accounts
- 10 users: Receives events only from those 10 accounts

**Important**: Before configuring user filters, check the monitored users list for reference:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
```

**Note**: The actor may monitor additional users beyond the returned list.

**Format Rules**:
- Comma-separated, no spaces
- Case-insensitive
- No @ symbol
- Usernames only (not display names)
- Can include usernames not in the returned list (actor may still monitor them)

**Validation**: The application validates configured usernames on startup and provides advisory warnings for usernames not in the returned list. These warnings are informational - the actor may still monitor those users.

#### KEYWORDS

**Required**: No  
**Type**: Comma-separated string  
**Default**: Empty (all content)  
**Example**: `KEYWORDS=bitcoin,ethereum,crypto,defi`

Filter events to only include those containing specific keywords. Leave empty to receive all events regardless of content.

**Format Rules**:
- Comma-separated, no spaces
- Case-insensitive matching
- Searches in tweet text and profile fields
- Partial word matching (e.g., "crypto" matches "cryptocurrency")

---

### Understanding Two-Layer Filtering

The application uses a two-layer filtering system that combines actor-side and client-side filtering for optimal cost efficiency and flexibility.

#### Layer 1: Actor-Side Filtering (Cost Optimization)

When you configure the `USERS` environment variable, the application includes them in the WebSocket subscribe message. The actor filters events at the source before delivering them to your client.

**Benefits**:
- Reduces network traffic (fewer events transmitted)
- Reduces the number of events you're charged for
- Reduces processing load (fewer events to handle)

**How it works**:
```
User Config: USERS=elonmusk,vitalikbuterin
         ↓
Application connects via WebSocket
         ↓
Application sends subscribe message: {"op":"subscribe","channels":["all"],"users":["elonmusk","vitalikbuterin"]}
         ↓
Actor filters at source: Only sends elonmusk and vitalikbuterin events
         ↓
Client receives: ONLY filtered events
         ↓
Charged for: Only the 2 accounts' events ✅
```

#### Layer 2: Client-Side Filtering (Additional Refinement)

After events are received from the actor, the application applies additional filters based on `KEYWORDS` and event types. This happens in the FilterPipeline component.

**Benefits**:
- Additional refinement of received events
- Flexible filtering by keywords and event types
- Applied after events are delivered

**How it works**:
```
Events received from actor (already filtered by users)
         ↓
FilterPipeline applies keyword filters
         ↓
FilterPipeline applies event type filters
         ↓
Filtered events sent to output channels
```

#### Combined Example

**Configuration**:
```env
USERS=elonmusk,vitalikbuterin,cz_binance
KEYWORDS=bitcoin,ethereum
```

**Flow**:
1. **Actor-Side (Layer 1)**: Actor only sends events from elonmusk, vitalikbuterin, and cz_binance
   - Only these 3 accounts' events are delivered

2. **Client-Side (Layer 2)**: Application filters for keywords "bitcoin" or "ethereum"
   - Further filters the received events by keywords

**Result**: You receive events from 3 accounts, filtered by keywords.

#### Actor-Side vs Client-Side Filtering

| Aspect | Actor-Side (USERS) | Client-Side (KEYWORDS) |
|--------|-------------------|------------------------|
| **Where** | At the actor (source) | In the application |
| **Network Traffic** | Reduces traffic ✅ | No traffic impact |
| **Filters By** | Twitter usernames | Keywords, event types |
| **Configuration** | USERS env variable | KEYWORDS env variable |
| **Validation** | Validated on startup | No validation needed |

#### Best Practices

1. **Use actor-side filtering to control event volume**: Configure `USERS` if you only need specific accounts. This reduces the number of events delivered to your client.

2. **Use client-side filtering for refinement**: Use `KEYWORDS` to further filter events after they're received. This is useful for finding specific topics.

3. **Combine both layers**: Use `USERS` to select accounts and `KEYWORDS` to refine results:
   ```env
   USERS=elonmusk,vitalikbuterin,cz_binance  # Select accounts
   KEYWORDS=bitcoin,ethereum,defi             # Refine by keywords
   ```

4. **Check monitored users for reference**: Before configuring `USERS`, you can check the monitored users list for reference:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
   ```
   **Note**: The actor may monitor additional users beyond this list.

---

### Output Channels

#### CLI_ENABLED

**Required**: No  
**Type**: Boolean  
**Default**: `true`  
**Example**: `CLI_ENABLED=true`

Enable or disable CLI output (live stream in terminal).

#### CLI_STATS_INTERVAL

**Required**: No  
**Type**: Number (milliseconds)  
**Default**: `60000` (1 minute)  
**Example**: `CLI_STATS_INTERVAL=30000`

Interval between statistics displays in CLI output.

#### DASHBOARD_ENABLED

**Required**: No  
**Type**: Boolean  
**Default**: `true`  
**Example**: `DASHBOARD_ENABLED=true`

Enable or disable the web dashboard.

#### DASHBOARD_PORT

**Required**: No  
**Type**: Number  
**Default**: `3000`  
**Example**: `DASHBOARD_PORT=8080`

Port for the web dashboard server. The dashboard will be accessible at `http://localhost:{PORT}`.

---

### Alert Configuration - Telegram

#### TELEGRAM_ENABLED

**Required**: No  
**Type**: Boolean  
**Default**: `false`  
**Example**: `TELEGRAM_ENABLED=true`

Enable or disable Telegram alerts.

#### TELEGRAM_BOT_TOKEN

**Required**: If Telegram is enabled  
**Type**: String  
**Default**: None  
**Example**: `TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

Telegram bot token from [@BotFather](https://t.me/BotFather).

**How to get a bot token**:
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` command
3. Follow the prompts to create your bot
4. Copy the token provided

#### TELEGRAM_CHAT_ID

**Required**: If Telegram is enabled  
**Type**: String  
**Default**: None  
**Example**: `TELEGRAM_CHAT_ID=123456789`

Telegram chat ID where alerts will be sent.

**How to get your chat ID**:
1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Copy the ID provided
3. Alternatively, add your bot to a group and use the group's chat ID

---

### Alert Configuration - Discord

#### DISCORD_ENABLED

**Required**: No  
**Type**: Boolean  
**Default**: `false`  
**Example**: `DISCORD_ENABLED=true`

Enable or disable Discord alerts.

#### DISCORD_WEBHOOK_URL

**Required**: If Discord is enabled  
**Type**: String (URL)  
**Default**: None  
**Example**: `DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdefg`

Discord webhook URL for sending alerts.

**How to create a webhook**:
1. Open your Discord server settings
2. Go to Integrations → Webhooks
3. Click "New Webhook"
4. Configure the webhook (name, channel)
5. Copy the webhook URL

---

### Alert Configuration - Generic Webhook

#### WEBHOOK_ENABLED

**Required**: No  
**Type**: Boolean  
**Default**: `false`  
**Example**: `WEBHOOK_ENABLED=true`

Enable or disable generic webhook alerts.

#### WEBHOOK_URL

**Required**: If webhook is enabled  
**Type**: String (URL)  
**Default**: None  
**Example**: `WEBHOOK_URL=https://your-webhook-url.com/endpoint`

Generic webhook URL for POST requests. The application will POST JSON event data to this URL.

**Webhook Payload Format**:
```json
{
  "type": "post_created",
  "timestamp": "2024-01-15T14:30:22.000Z",
  "user": {
    "username": "elonmusk",
    "displayName": "Elon Musk"
  },
  "data": { ... }
}
```

---

### Advanced Configuration

#### HEALTH_PORT

**Required**: No  
**Type**: Number  
**Default**: `3001`  
**Example**: `HEALTH_PORT=8081`

Port for the health monitoring HTTP server. The `/status` endpoint will be available at `http://localhost:{PORT}/status`.

#### DEDUP_TTL

**Required**: No  
**Type**: Number (seconds)  
**Default**: `60`  
**Example**: `DEDUP_TTL=120`

Time-to-live for deduplication cache entries. Events are cached for this duration to prevent duplicates.

**Recommendations**:
- Lower values (30-60s) for high-volume streams
- Higher values (120-300s) for low-volume streams or if duplicates are common

#### RECONNECT_INITIAL_DELAY

**Required**: No  
**Type**: Number (milliseconds)  
**Default**: `1000`  
**Example**: `RECONNECT_INITIAL_DELAY=2000`

Initial delay before the first reconnection attempt after a connection failure.

#### RECONNECT_MAX_DELAY

**Required**: No  
**Type**: Number (milliseconds)  
**Default**: `30000`  
**Example**: `RECONNECT_MAX_DELAY=60000`

Maximum delay between reconnection attempts. The delay increases exponentially but never exceeds this value.

#### RECONNECT_BACKOFF_MULTIPLIER

**Required**: No  
**Type**: Number  
**Default**: `2.0`  
**Example**: `RECONNECT_BACKOFF_MULTIPLIER=1.5`

Multiplier for exponential backoff. Each reconnection attempt waits `previousDelay * multiplier` milliseconds.

**Formula**: `delay = min(initialDelay * multiplier^attempt, maxDelay)`

#### RECONNECT_MAX_ATTEMPTS

**Required**: No  
**Type**: Number  
**Default**: `0` (infinite)  
**Example**: `RECONNECT_MAX_ATTEMPTS=10`

Maximum number of reconnection attempts. Set to `0` for infinite retries.

#### ACTIVE_USERS_REFRESH_INTERVAL

**Required**: No  
**Type**: Number (milliseconds)  
**Default**: `240000` (4 minutes)  
**Example**: `ACTIVE_USERS_REFRESH_INTERVAL=600000`

Interval for refreshing the active users list from the Apify actor.

#### ALERT_RATE_LIMIT

**Required**: No  
**Type**: Number  
**Default**: `10`  
**Example**: `ALERT_RATE_LIMIT=20`

Maximum number of alerts per minute per channel. Excess alerts are dropped.

---

## JSON Configuration File

Configuration can also be provided via `config/config.json`. This is useful for:
- Committing non-sensitive configuration to version control
- Sharing configuration across team members
- Managing multiple configuration profiles

### File Location

`config/config.json` (relative to project root)

### Schema

```json
{
  "apify": {
    "channels": ["all"] | ["tweets"] | ["following"] | ["profile"] | ["tweets", "following"]
  },
  "filters": {
    "users": ["username1", "username2"],
    "keywords": ["keyword1", "keyword2"]
  },
  "outputs": {
    "cli": {
      "enabled": true,
      "statsInterval": 60000
    },
    "dashboard": {
      "enabled": true,
      "port": 3000
    },
    "alerts": {
      "telegram": {
        "enabled": false
      },
      "discord": {
        "enabled": false
      },
      "webhook": {
        "enabled": false
      }
    }
  },
  "dedup": {
    "ttl": 60
  },
  "reconnect": {
    "initialDelay": 1000,
    "maxDelay": 30000,
    "backoffMultiplier": 2.0,
    "maxAttempts": 0
  },
  "activeUsers": {
    "refreshInterval": 240000
  },
  "health": {
    "port": 3001
  }
}
```

### Example config.json

See `config/config.example.json` for a complete example.

**Note**: Sensitive values like `APIFY_TOKEN`, `TELEGRAM_BOT_TOKEN`, etc. should **never** be stored in `config.json`. Always use environment variables for secrets.

---

## Configuration Examples

### Example 1: Basic Setup (CLI Only)

Minimal configuration for CLI output only.

**.env**:
```env
APIFY_TOKEN=your_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
CHANNELS=all
DASHBOARD_ENABLED=false
```

### Example 2: Dashboard with Filters

Monitor specific users and keywords with web dashboard.

**.env**:
```env
APIFY_TOKEN=your_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
CHANNELS=tweets
USERS=elonmusk,vitalikbuterin,cz_binance
KEYWORDS=bitcoin,ethereum,crypto
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000
CLI_ENABLED=false
```

### Example 3: Telegram Alerts Only

Receive alerts on Telegram without CLI or dashboard.

**.env**:
```env
APIFY_TOKEN=your_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
CHANNELS=all
CLI_ENABLED=false
DASHBOARD_ENABLED=false
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### Example 4: All Outputs Enabled

Use all output channels simultaneously.

**.env**:
```env
APIFY_TOKEN=your_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
CHANNELS=all
USERS=elonmusk,vitalikbuterin
KEYWORDS=bitcoin,ethereum

# CLI
CLI_ENABLED=true
CLI_STATS_INTERVAL=60000

# Dashboard
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000

# Telegram
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# Discord
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdefg

# Webhook
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://your-webhook-url.com/endpoint
```

### Example 5: High-Volume Stream Optimization

Configuration optimized for high-volume streams.

**.env**:
```env
APIFY_TOKEN=your_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
CHANNELS=all

# Shorter dedup TTL for high volume
DEDUP_TTL=30

# Faster reconnection
RECONNECT_INITIAL_DELAY=500
RECONNECT_MAX_DELAY=10000

# More frequent stats
CLI_STATS_INTERVAL=30000

# Higher rate limit
ALERT_RATE_LIMIT=20
```

### Example 6: Development vs Production

Use different configurations for development and production.

**Development (.env.development)**:
```env
APIFY_TOKEN=dev_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
CHANNELS=tweets
USERS=testuser1,testuser2
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3000
CLI_ENABLED=true
TELEGRAM_ENABLED=false
```

**Production (.env.production)**:
```env
APIFY_TOKEN=prod_token_here
APIFY_ACTOR_URL=https://muhammetakkurtt--crypto-twitter-tracker.apify.actor
CHANNELS=all
DASHBOARD_ENABLED=true
DASHBOARD_PORT=8080
CLI_ENABLED=false
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=prod_bot_token
TELEGRAM_CHAT_ID=prod_chat_id
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=prod_webhook_url
```

### Example 7: Mixed Configuration (Environment + JSON)

Use JSON for non-sensitive settings and environment variables for secrets.

**config/config.json**:
```json
{
  "apify": {
    "channels": ["tweets"]
  },
  "filters": {
    "users": ["elonmusk", "vitalikbuterin"],
    "keywords": ["bitcoin", "ethereum"]
  },
  "outputs": {
    "cli": {
      "enabled": true,
      "statsInterval": 60000
    },
    "dashboard": {
      "enabled": true,
      "port": 3000
    },
    "alerts": {
      "telegram": {
        "enabled": true
      }
    }
  }
}
```

**.env**:
```env
# Secrets only
APIFY_TOKEN=your_token_here
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

---

## Advanced Configuration

### Custom Reconnection Strategy

Fine-tune reconnection behavior for your network conditions.

**Aggressive Reconnection** (fast recovery, more network traffic):
```env
RECONNECT_INITIAL_DELAY=500
RECONNECT_MAX_DELAY=5000
RECONNECT_BACKOFF_MULTIPLIER=1.5
RECONNECT_MAX_ATTEMPTS=0
```

**Conservative Reconnection** (slower recovery, less network traffic):
```env
RECONNECT_INITIAL_DELAY=5000
RECONNECT_MAX_DELAY=60000
RECONNECT_BACKOFF_MULTIPLIER=2.5
RECONNECT_MAX_ATTEMPTS=10
```

### Deduplication Tuning

Adjust deduplication based on your use case.

**High-Volume Streams** (shorter TTL, less memory):
```env
DEDUP_TTL=30
```

**Low-Volume Streams** (longer TTL, more duplicate protection):
```env
DEDUP_TTL=300
```

**No Deduplication** (not recommended):
```env
DEDUP_TTL=0
```

### Alert Rate Limiting

Adjust rate limits based on your alert channel limits.

**Telegram** (official limit: 30 messages/second per chat):
```env
ALERT_RATE_LIMIT=20  # Conservative limit
```

**Discord** (official limit: 5 requests/second per webhook):
```env
ALERT_RATE_LIMIT=10  # Conservative limit
```

**Custom Webhook** (depends on your service):
```env
ALERT_RATE_LIMIT=50  # Adjust based on your service limits
```

---

## Runtime Subscription Management

The application supports runtime modification of subscription parameters through the dashboard interface. This section explains how runtime changes interact with configuration files.

### Runtime vs Configuration

**Configuration File** (`.env` or `config.json`):
- Defines the initial subscription state at startup
- Persists across restarts
- Source field: "config"

**Runtime Changes** (via dashboard):
- Modify subscription without restarting
- Temporary - do not persist across restarts
- Source field: "runtime"

### How Runtime Changes Work

When you modify the subscription via the dashboard:

1. **Immediate Effect**: Changes are applied immediately to the active connection
2. **Broadcast**: All connected dashboards receive the update
3. **Temporary**: Changes are stored in memory only
4. **Restart Behavior**: After restart, the application reverts to configuration file settings

**Example Flow**:

```
Startup:
  Load from .env: CHANNELS=all, USERS=elonmusk
  State: { channels: ["all"], users: ["elonmusk"], source: "config" }
         ↓
Runtime Change (via dashboard):
  User changes to: channels=["tweets"], users=["elonmusk", "vitalikbuterin"]
  State: { channels: ["tweets"], users: ["elonmusk", "vitalikbuterin"], source: "runtime" }
         ↓
Restart:
  Load from .env: CHANNELS=all, USERS=elonmusk
  State: { channels: ["all"], users: ["elonmusk"], source: "config" }
  (Runtime changes are lost)
```

### Source Field

The `source` field in the subscription state indicates the origin of the current configuration:

**"config"**:
- Subscription loaded from configuration file at startup
- No runtime modifications have been made
- Matches `.env` or `config.json` settings

**"runtime"**:
- Subscription modified via dashboard
- May differ from configuration file
- Will revert to "config" after restart

**Checking Source**:

```javascript
socket.emit('getRuntimeSubscription', (response) => {
  if (response.data.source === 'config') {
    console.log('Using configuration file settings');
  } else {
    console.log('Modified at runtime - will revert after restart');
  }
});
```

### Making Runtime Changes Permanent

Runtime changes are temporary by design. To make changes permanent, you must update your configuration file.

**Step 1: Note Current Runtime State**

Via dashboard or API:
```javascript
socket.emit('getRuntimeSubscription', (response) => {
  console.log('Current channels:', response.data.channels);
  console.log('Current users:', response.data.users);
});
```

**Step 2: Update Configuration File**

Edit `.env`:
```env
# Update to match runtime state
CHANNELS=tweets,following
USERS=elonmusk,vitalikbuterin,cz_binance
```

Or edit `config/config.json`:
```json
{
  "apify": {
    "channels": ["tweets", "following"]
  },
  "filters": {
    "users": ["elonmusk", "vitalikbuterin", "cz_binance"]
  }
}
```

**Step 3: Restart Application**

```bash
npm start
```

After restart:
- Subscription loads from configuration file
- Source field changes to "config"
- Changes are now permanent

### Configuration Priority with Runtime Changes

The configuration priority system applies only at startup:

```
Startup: Environment Variables > config.json > Default Values
Runtime: Dashboard changes override everything (temporarily)
Restart: Back to startup priority
```

**Example**:

```env
# .env
CHANNELS=all
USERS=elonmusk
```

```json
// config.json
{
  "apify": {
    "channels": ["tweets"]
  }
}
```

**At Startup**:
- Environment variable wins: `channels: ["all"]`
- Source: "config"

**After Runtime Change**:
- Dashboard sets: `channels: ["following"]`
- Source: "runtime"
- Configuration files are ignored (temporarily)

**After Restart**:
- Environment variable wins again: `channels: ["all"]`
- Source: "config"
- Runtime changes are lost

### Best Practices

**1. Use Runtime Changes for Experimentation**

Runtime changes are perfect for testing different configurations:
- Try different channel combinations
- Test user filters
- Experiment with idle mode
- No need to restart or edit files

**2. Update Configuration Files for Production**

Once you've found a configuration that works:
- Update `.env` or `config.json`
- Restart to verify configuration loads correctly
- Document the change in version control

**3. Monitor Source Field**

Check the source field to know if runtime changes are active:
```javascript
socket.on('runtimeSubscriptionUpdated', (state) => {
  if (state.source === 'runtime') {
    console.warn('Runtime changes active - will revert after restart');
  }
});
```

**4. Document Runtime Changes**

If you make runtime changes in production:
- Document what was changed and why
- Update configuration files before next restart
- Notify team members of temporary changes

### Troubleshooting Runtime Changes

**Problem**: Runtime changes not persisting after restart

**Solution**: This is expected behavior. Runtime changes are temporary. Update configuration files to make changes permanent.

**Problem**: Configuration file changes not taking effect

**Solution**: Runtime changes override configuration. Restart the application to load configuration file settings.

**Problem**: Source field shows "runtime" but I didn't make changes

**Solution**: Another client (dashboard instance) made runtime changes. Check with team members or restart to revert to configuration.

**Problem**: Can't modify subscription from dashboard

**Solution**: Only control clients (localhost) can modify subscriptions. Remote clients are read-only for security.

### Example Scenarios

#### Scenario 1: Temporary Cost Reduction

You want to temporarily reduce costs without editing configuration:

1. Open dashboard (localhost)
2. Change users to a smaller set
3. Apply changes
4. Monitor for desired period
5. Restart to revert to full configuration

#### Scenario 2: Testing New Filters

You want to test new user filters before committing:

1. Make runtime changes via dashboard
2. Monitor events for a few hours
3. If satisfied, update `.env` file
4. Restart to make permanent

#### Scenario 3: Emergency Pause

You need to pause monitoring immediately:

1. Open dashboard
2. Uncheck all channels (idle mode)
3. Apply changes
4. Monitoring pauses immediately
5. Restart later to resume with configuration

#### Scenario 4: Multi-Dashboard Coordination

Multiple team members have dashboards open:

1. Team member A makes runtime change
2. All dashboards receive broadcast
3. All dashboards show updated state
4. Source field shows "runtime" for everyone
5. After restart, all revert to configuration

---

## Best Practices

### Security

1. **Never commit secrets** to version control
   - Use `.env` for secrets (add to `.gitignore`)
   - Use `config.json` for non-sensitive settings

2. **Use environment-specific configurations**
   - `.env.development` for development
   - `.env.production` for production
   - Load the appropriate file based on `NODE_ENV`

3. **Rotate tokens regularly**
   - Generate new Apify tokens periodically
   - Update bot tokens if compromised

4. **Restrict access**
   - Use firewall rules to limit access to dashboard and health endpoints
   - Consider adding authentication for production deployments

### Performance

1. **Optimize filters**
   - Use specific user filters to reduce processing
   - Use targeted keywords to reduce noise

2. **Tune deduplication**
   - Lower TTL for high-volume streams
   - Higher TTL for low-volume streams

3. **Disable unused outputs**
   - Set `CLI_ENABLED=false` if not using CLI
   - Disable alert channels you're not using

4. **Monitor resource usage**
   - Check `/status` endpoint regularly
   - Monitor memory usage with long-running instances

### Reliability

1. **Use infinite reconnection attempts**
   - Set `RECONNECT_MAX_ATTEMPTS=0` for production
   - Ensures the application recovers from temporary outages

2. **Configure appropriate backoff**
   - Use exponential backoff to avoid overwhelming the server
   - Set reasonable max delay (30-60 seconds)

3. **Enable health monitoring**
   - Expose `/status` endpoint for monitoring systems
   - Set up alerts for connection failures

4. **Use multiple output channels**
   - Enable both dashboard and alerts for redundancy
   - If one channel fails, others continue working

### Development

1. **Use config.json for team settings**
   - Commit non-sensitive configuration
   - Share common filters and settings

2. **Use .env for personal settings**
   - Keep personal tokens in `.env` (gitignored)
   - Override team settings as needed

3. **Test with different channels**
   - Start with `CHANNELS=tweets` for lower volume
   - Test filters with specific users

4. **Monitor logs during development**
   - Enable CLI output for debugging
   - Check for parsing errors and connection issues

---

## Troubleshooting Configuration

### Configuration Not Loading

**Problem**: Changes to `.env` or `config.json` not taking effect

**Solutions**:
- Restart the application after configuration changes
- Verify file paths are correct (`config/config.json`, not `config.json`)
- Check for syntax errors in JSON files
- Ensure `.env` file is in the project root

### Environment Variables Not Working

**Problem**: Environment variables not being read

**Solutions**:
- Verify `.env` file exists in project root
- Check for typos in variable names (case-sensitive)
- Ensure no spaces around `=` (use `KEY=value`, not `KEY = value`)
- Restart the application after changes

### Priority Issues

**Problem**: Wrong configuration value being used

**Solutions**:
- Remember priority: Environment Variables > config.json > Defaults
- Check if the same setting exists in multiple places
- Use environment variables to override config.json
- Remove conflicting settings from config.json

### Invalid Configuration Values

**Problem**: Application fails to start due to invalid configuration

**Solutions**:
- Check logs for specific error messages
- Verify data types (numbers vs strings)
- Ensure boolean values are `true` or `false` (not `yes`/`no`)
- Validate URLs are complete and properly formatted

### Empty Event Stream

**Problem**: Application connects successfully but no events are received

This is the most common issue when using user filtering. Here's how to diagnose and fix it:

#### Cause 1: Usernames Not Monitored by Actor

**Symptom**: Startup shows validation warnings about usernames not in the returned list

**Example Warning**:
```
⚠️  WARNING: User filter validation notice!

The following usernames are NOT in the returned monitored users list:
  someuser, anotheruser

Note: The actor may monitor additional users beyond this list.
If these users are monitored by the actor, you WILL receive their events.
```

**What This Means**:
- These usernames are not in the `/active-users` endpoint response
- The actor may still monitor them (the endpoint returns a subset)
- If the actor doesn't monitor them, you won't receive events

**Solution**:
1. Check the monitored users list for reference:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
   ```

2. If your usernames are not in the list, you have two options:
   - Keep them (actor may still monitor them)
   - Replace with usernames from the list (guaranteed to work)

3. Restart the application

#### Cause 2: All Configured Users Not in Returned List

**Symptom**: All your configured usernames show validation warnings

**Solution**:
1. Remove the `USERS` filter temporarily to verify the connection works:
   ```env
   USERS=
   ```

2. Check which users are in the returned list:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
   ```

3. Configure usernames from the list (or keep your usernames if you believe the actor monitors them)

#### Cause 3: Usernames With Typos

**Symptom**: You configured usernames but they have typos or wrong format

**Common Mistakes**:
- Including @ symbol: `@elonmusk` (wrong) vs `elonmusk` (correct)
- Wrong capitalization: Usernames are case-insensitive
- Spaces in the list: `elon musk, vitalik` (wrong) vs `elonmusk,vitalikbuterin` (correct)
- Display names instead of usernames: `Elon Musk` (wrong) vs `elonmusk` (correct)

**Solution**:
1. Remove @ symbols
2. Remove spaces between usernames
3. Use actual Twitter usernames (not display names)
4. Verify format is correct

#### Cause 4: Monitored Accounts Not Posting

**Symptom**: Valid usernames but still no events

**Solution**:
- The accounts you're monitoring may not be posting during your test period
- Try adding a high-volume account like `elonmusk` to verify the connection works
- Check Twitter directly to see if those accounts are posting
- Wait a few minutes - some accounts post infrequently

#### Cause 5: Overly Restrictive Filters

**Symptom**: Using both `USERS` and `KEYWORDS` filters

**Example**:
```env
USERS=elonmusk
KEYWORDS=veryspecifickeyword
```

**Solution**:
- Actor-side filtering (USERS) reduces events to only those users
- Client-side filtering (KEYWORDS) further reduces events
- If keywords are too specific, you may receive no events
- Try removing `KEYWORDS` temporarily to verify events are being received

#### Diagnostic Steps

Follow these steps to diagnose empty event stream issues:

1. **Check connection status**:
   ```bash
   curl http://localhost:3001/status
   ```
   Verify `connection.status` is `"connected"`

2. **Check validation warnings**: Look at application startup logs for advisory warnings about usernames

3. **Test without filters**:
   ```env
   USERS=
   KEYWORDS=
   ```
   If events appear, your filters are too restrictive

4. **Test with a user from the returned list**:
   ```env
   USERS=elonmusk
   ```
   If events appear, your original usernames may not be monitored

5. **Check monitored users list for reference**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/active-users
   ```
   Compare your usernames with this list

6. **Check actor health**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://muhammetakkurtt--crypto-twitter-tracker.apify.actor/health
   ```
   Verify the actor is running and healthy

#### Quick Fix Checklist

- [ ] Check if usernames are in the returned monitored users list (for reference)
- [ ] No @ symbols in usernames
- [ ] No spaces between comma-separated usernames
- [ ] Using usernames, not display names
- [ ] Understand that actor may monitor users not in the returned list
- [ ] Application shows validation success on startup
- [ ] Connection status is "connected"
- [ ] Filters are not overly restrictive
- [ ] Monitored accounts are actually posting

---

## Configuration Reference

For a complete list of all configuration options with examples, see:
- [`.env.example`](../.env.example) - All environment variables
- [`config/config.example.json`](../config/config.example.json) - JSON configuration example

---

## Support

If you need help with configuration:
1. Check this guide and the examples
2. Review the [README.md](../README.md) troubleshooting section
3. Check the [API Documentation](API.md) for endpoint details
4. Open an issue on GitHub with your configuration (sanitize tokens!)
