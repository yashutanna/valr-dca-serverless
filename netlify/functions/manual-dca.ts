import type { Handler } from '@netlify/functions';
import { createHmac } from 'node:crypto';
import { buy } from '../../src/buy-crypto.js';

// Manual DCA trigger - call this via URL to execute DCA immediately
// Uses time-based HMAC signature for security
// Generate signature offline with: echo -n "TIMESTAMP" | openssl dgst -sha256 -hmac "YOUR_SECRET" | cut -d' ' -f2
// URL: https://your-site.netlify.app/.netlify/functions/manual-dca?timestamp=TIMESTAMP&signature=SIGNATURE&force=true
export const handler: Handler = async function (event, _context) {
  console.log('Manual DCA trigger attempted');

  const timestamp = event.queryStringParameters?.timestamp;
  const signature = event.queryStringParameters?.signature;
  const configuredSecret = process.env.MANUAL_DCA_SECRET;

  if (!configuredSecret) {
    console.error('MANUAL_DCA_SECRET not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Manual DCA trigger not configured. Set MANUAL_DCA_SECRET environment variable.',
      }),
    };
  }

  // Validate timestamp and signature are provided
  if (!timestamp || !signature) {
    console.warn('Manual DCA trigger failed - missing timestamp or signature');
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized. Missing timestamp or signature parameter.',
      }),
    };
  }

  // Validate timestamp is a valid number
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    console.warn('Manual DCA trigger failed - invalid timestamp format');
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized. Invalid timestamp format.',
      }),
    };
  }

  // Check if timestamp is within 5 minutes (prevents replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(now - timestampNum);
  const maxAge = 5 * 60; // 5 minutes in seconds

  if (timeDiff > maxAge) {
    console.warn(`Manual DCA trigger failed - timestamp too old (${timeDiff}s ago)`);
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized. Request expired (timestamp must be within 5 minutes).',
      }),
    };
  }

  // Verify HMAC signature
  const expectedSignature = createHmac('sha256', configuredSecret)
    .update(timestamp)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn('Manual DCA trigger failed - invalid signature');
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized. Invalid signature.',
      }),
    };
  }

  console.log('Manual DCA authenticated successfully');

  const forceExecute = event.queryStringParameters?.force === 'true';

  if (forceExecute) {
    // Temporarily override the hour check by setting env var
    const originalHour = process.env.DCA_EXECUTION_HOUR;
    process.env.DCA_EXECUTION_HOUR = new Date().getHours().toString();

    console.log('Force flag enabled - bypassing hour check');

    try {
      await buy();

      // Restore original hour
      process.env.DCA_EXECUTION_HOUR = originalHour;

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'DCA executed successfully (forced)',
        }),
      };
    } catch (error) {
      // Restore original hour even on error
      process.env.DCA_EXECUTION_HOUR = originalHour;

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  } else {
    // Normal execution - respects DCA_EXECUTION_HOUR
    try {
      await buy();

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'DCA function called - check logs to see if it executed',
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  }
};
