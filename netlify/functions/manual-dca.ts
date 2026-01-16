import type { Handler } from '@netlify/functions';
import { buy } from '../../src/buy-crypto.js';

// Manual DCA trigger - call this via URL to execute DCA immediately
// URL: https://your-site.netlify.app/.netlify/functions/manual-dca?secret=YOUR_SECRET
// Add ?force=true to bypass the hour check and execute immediately
export const handler: Handler = async function (event, _context) {
  console.log('Manual DCA trigger attempted');

  // Password protection - check secret parameter
  const providedSecret = event.queryStringParameters?.secret;
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

  if (!providedSecret || providedSecret !== configuredSecret) {
    console.warn('Manual DCA trigger failed - invalid or missing secret');
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: 'Unauthorized. Invalid or missing secret parameter.',
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
