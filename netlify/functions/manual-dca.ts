import type { Handler } from '@netlify/functions';
import { buy } from '../../src/buy-crypto.js';

// Manual DCA trigger - call this via URL to execute DCA immediately
// URL: https://your-site.netlify.app/.netlify/functions/manual-dca
// Add ?force=true to bypass the hour check and execute immediately
export const handler: Handler = async function (event, _context) {
  console.log('Manual DCA triggered');

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
