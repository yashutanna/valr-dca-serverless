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

export default schedule('@hourly', handler);
