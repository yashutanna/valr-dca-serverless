import type { Config } from '@netlify/functions';
import { buy } from '../../src/buy-crypto.js';

// Modern Netlify scheduled function format
// Runs every hour to check if it's time to execute DCA
// The customerOrderId ensures DCA only executes once per day
// even if the function runs multiple times at the configured hour
export default async (req: Request): Promise<void> => {
  console.log('Start scheduled DCA');

  try {
    const payload = (await req.json()) as { next_run?: string };
    if (payload.next_run) {
      console.log('Next scheduled run:', payload.next_run);
    }
  } catch {
    // Payload parsing is optional
  }

  await buy();

  console.log('Completed scheduled DCA');
};

export const config: Config = {
  schedule: '@hourly',
};
