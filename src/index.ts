/**
 * Crypto Twitter Alpha Stream
 * Main entry point for the application
 * 
 * Usage:
 *   npm start
 *   node dist/index.js
 *   node dist/index.js --config=path/to/config.json
 */

import { Application } from './Application';

/**
 * Parse command-line arguments
 */
function parseArgs(): { configFilePath?: string } {
  const args = process.argv.slice(2);
  const result: { configFilePath?: string } = {};

  for (const arg of args) {
    if (arg.startsWith('--config=')) {
      result.configFilePath = arg.substring('--config='.length);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      printVersion();
      process.exit(0);
    }
  }

  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Crypto Twitter Alpha Stream - Real-time Twitter event monitoring

Usage:
  npm start
  node dist/index.js [options]

Options:
  --config=<path>    Path to config.json file (default: config/config.json)
  --help, -h         Show this help message
  --version, -v      Show version information

Environment Variables:
  APIFY_TOKEN              Required: Apify actor authentication token
                           Get your token: https://console.apify.com/settings/integrations?fpr=muh
  APIFY_ACTOR_URL          Required: Apify actor URL (default: https://muhammetakkurtt--crypto-twitter-tracker.apify.actor)
  ENDPOINT                 SSE endpoint: all, tweets, following, profile (default: all)
  USERS                    Comma-separated list of usernames to filter
  KEYWORDS                 Comma-separated list of keywords to filter
  CLI_ENABLED              Enable CLI output (default: true)
  DASHBOARD_ENABLED        Enable dashboard output (default: false)
  DASHBOARD_PORT           Dashboard port (default: 3000)
  TELEGRAM_ENABLED         Enable Telegram alerts (default: false)
  TELEGRAM_BOT_TOKEN       Telegram bot token
  TELEGRAM_CHAT_ID         Telegram chat ID
  DISCORD_ENABLED          Enable Discord alerts (default: false)
  DISCORD_WEBHOOK_URL      Discord webhook URL
  WEBHOOK_ENABLED          Enable generic webhook alerts (default: false)
  WEBHOOK_URL              Generic webhook URL

Examples:
  # Start with default configuration
  npm start

  # Start with custom config file
  node dist/index.js --config=my-config.json

  # Start with environment variables
  APIFY_TOKEN=xxx ENDPOINT=tweets USERS=elonmusk,vitalikbuterin npm start

For more information, visit: https://github.com/your-repo/crypto-twitter-alpha-stream
  `);
}

/**
 * Print version information
 */
function printVersion(): void {
  try {
    const packageJson = require('../package.json');
    console.log(`Crypto Twitter Alpha Stream v${packageJson.version}`);
  } catch (error) {
    console.log('Crypto Twitter Alpha Stream (version unknown)');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Parse command-line arguments
    const args = parseArgs();

    // Create and start application
    const app = new Application({
      configFilePath: args.configFilePath
    });

    await app.start();

    // Application will run until interrupted (SIGINT/SIGTERM)
    // Shutdown is handled by the Application class

  } catch (error) {
    // Handle startup errors with clear messages
    if (error instanceof Error) {
      console.error('');
      console.error('❌ Failed to start application:');
      console.error('');
      console.error(`  ${error.message}`);
      console.error('');
      
      // Provide helpful hints for common errors
      if (error.message.includes('APIFY_TOKEN')) {
        console.error('💡 Hint: Set the APIFY_TOKEN environment variable:');
        console.error('  export APIFY_TOKEN=your-token-here');
        console.error('  npm start');
      } else if (error.message.includes('EADDRINUSE')) {
        console.error('💡 Hint: Port is already in use. Try a different port:');
        console.error('  DASHBOARD_PORT=3001 npm start');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Hint: Cannot connect to Apify actor. Check:');
        console.error('  - Your internet connection');
        console.error('  - The actor is running at https://muhammetakkurtt--crypto-twitter-tracker.apify.actor');
        console.error('  - The APIFY_ACTOR_URL environment variable is correct');
      }
      
      console.error('');
    } else {
      console.error('❌ An unexpected error occurred:', error);
    }

    process.exit(1);
  }
}

// Run the application
main();
