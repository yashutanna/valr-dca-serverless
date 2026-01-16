import { schedule, type Handler } from '@netlify/functions';
import { buy } from '../../src/buy-crypto.js';

const handler: Handler = async function (_event, _context) {
  console.log('Start scheduled DCA');
  await buy();
  console.log('Completed scheduled DCA');

  return {
    statusCode: 200,
  };
};

// Run every hour to check if it's time to execute DCA
// The customerOrderId ensures DCA only executes once per day
// even if the function runs multiple times at the configured hour
export default schedule('@hourly', handler);
