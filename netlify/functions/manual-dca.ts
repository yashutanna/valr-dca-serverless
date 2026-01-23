import { createHmac } from 'node:crypto';
import { buy } from '../../src/buy-crypto.js';

// Manual DCA trigger - call this via URL to execute DCA immediately
// Uses time-based HMAC signature for security
// Generate signature offline with: echo -n "TIMESTAMP" | openssl dgst -sha256 -hmac "YOUR_SECRET" | cut -d' ' -f2
// URL: https://your-site.netlify.app/.netlify/functions/manual-dca?timestamp=TIMESTAMP&signature=SIGNATURE&force=true

export default async (req: Request): Promise<Response> => {
  console.log('Manual DCA trigger attempted');

  // Parse query parameters from URL
  const url = new URL(req.url);
  const timestamp = url.searchParams.get('timestamp');
  const signature = url.searchParams.get('signature');
  const forceExecute = url.searchParams.get('force') === 'true';
  const configuredSecret = process.env.MANUAL_DCA_SECRET;

  if (!configuredSecret) {
    console.error('MANUAL_DCA_SECRET not configured');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Manual DCA trigger not configured. Set MANUAL_DCA_SECRET environment variable.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate timestamp and signature are provided
  if (!timestamp || !signature) {
    console.warn('Manual DCA trigger failed - missing timestamp or signature');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized. Missing timestamp or signature parameter.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate timestamp is a valid number
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    console.warn('Manual DCA trigger failed - invalid timestamp format');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized. Invalid timestamp format.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check if timestamp is within 5 minutes (prevents replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(now - timestampNum);
  const maxAge = 5 * 60; // 5 minutes in seconds

  if (timeDiff > maxAge) {
    console.warn(`Manual DCA trigger failed - timestamp too old (${timeDiff}s ago)`);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized. Request expired (timestamp must be within 5 minutes).',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Verify HMAC signature
  const expectedSignature = createHmac('sha256', configuredSecret).update(timestamp).digest('hex');

  if (signature !== expectedSignature) {
    console.warn('Manual DCA trigger failed - invalid signature');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized. Invalid signature.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.log('Manual DCA authenticated successfully');

  if (forceExecute) {
    // Temporarily override the hour check by setting env var
    const originalHour = process.env.DCA_EXECUTION_HOUR;
    process.env.DCA_EXECUTION_HOUR = new Date().getHours().toString();

    console.log('Force flag enabled - bypassing hour check');

    try {
      await buy();

      // Restore original hour
      process.env.DCA_EXECUTION_HOUR = originalHour;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'DCA executed successfully (forced)',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      // Restore original hour even on error
      process.env.DCA_EXECUTION_HOUR = originalHour;

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } else {
    // Normal execution - respects DCA_EXECUTION_HOUR
    try {
      await buy();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'DCA function called - check logs to see if it executed',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
};
