import { ValrClient } from 'valr-typescript-client';
import type { EnvConfig } from './types.js';

// Environment variable parsing with validation
function getEnvConfig(): EnvConfig {
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('API_KEY and API_SECRET environment variables are required');
  }

  // ValrClient requires exactly 64-character keys
  if (apiKey.length !== 64 || apiSecret.length !== 64) {
    throw new Error(
      `Invalid VALR credentials: API_KEY must be 64 characters (got ${apiKey.length}), API_SECRET must be 64 characters (got ${apiSecret.length})`
    );
  }

  // Parse DCA_EXECUTION_HOURS as comma-separated list, default to [15] if not set
  const dcaExecutionHours = process.env.DCA_EXECUTION_HOURS
    ? process.env.DCA_EXECUTION_HOURS.split(',').map((val) => Number(val.trim()))
    : [15];

  const dcaCurrencies = process.env.DCA_CURRENCIES?.split(',').map((val) => val.trim()) || [];
  const dcaAmounts = process.env.DCA_AMOUNTS?.split(',').map((val) => Number(val.trim())) || [];

  return {
    API_KEY: apiKey,
    API_SECRET: apiSecret,
    DCA_EXECUTION_HOURS: dcaExecutionHours,
    DCA_CURRENCIES: dcaCurrencies,
    DCA_AMOUNTS: dcaAmounts,
  };
}

const config = getEnvConfig();
const client = new ValrClient({
  apiKey: config.API_KEY,
  apiSecret: config.API_SECRET,
});

function isDcaHour(): boolean {
  // Read fresh from environment on each check to allow dynamic changes without redeployment
  const dcaHours = process.env.DCA_EXECUTION_HOURS
    ? process.env.DCA_EXECUTION_HOURS.split(',').map((val) => Number(val.trim()))
    : [15];
  // Use UTC hours to match Netlify's server timezone
  const currentHour = new Date().getUTCHours();
  const isMatch = dcaHours.includes(currentHour);
  console.log(
    `Checking DCA hour (UTC): current=${currentHour}, configured=[${dcaHours.join(',')}], match=${isMatch}`
  );
  return isMatch;
}

function getCustomerOrderId(pair: string): string {
  const now = new Date();
  const date = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const hour = now.getUTCHours();
  // Includes hour to allow multiple DCA executions per day at different configured hours
  // Uses UTC hours to match Netlify's server timezone
  return `${pair}-${year}-${month}-${date}-${hour}`;
}

async function hasAlreadyPlacedOrder(customerOrderId: string): Promise<boolean> {
  try {
    const pair = customerOrderId.split('-')[0];
    if (!pair) {
      throw new Error(`Invalid customerOrderId: ${customerOrderId}`);
    }

    const order = await client.trading.getOrderStatusByCustomerId(pair, customerOrderId);

    switch (order.orderStatus) {
      case 'FAILED':
      case 'CANCELLED':
        return false;
      case 'FILLED':
        return true;
      default: {
        console.warn(
          `unaccounted for orderTypeStatus(${order.orderStatus}), assuming order has already been placed`
        );
        return true;
      }
    }
  } catch {
    return false;
  }
}

async function placeBuyOrder(
  pair: string,
  amount: number,
  price: string,
  customerOrderId: string
): Promise<string | undefined> {
  console.log(`Placing Limit Post Only order of ${amount} on pair ${pair}`);

  const response = await client.trading.placeLimitOrder({
    side: 'BUY',
    quantity: amount.toString(),
    price: price,
    pair: pair,
    customerOrderId: customerOrderId,
    postOnlyReprice: true,
    timeInForce: 'GTC',
  });

  console.log(JSON.stringify(response, null, 2));
  return response.id;
}

export async function buy(): Promise<void> {
  // Read currencies and amounts fresh from environment to handle warm starts
  const dcaCurrencies = process.env.DCA_CURRENCIES?.split(',').map((val) => val.trim()) || [];
  const dcaAmounts = process.env.DCA_AMOUNTS?.split(',').map((val) => Number(val.trim())) || [];

  if (dcaCurrencies.length !== dcaAmounts.length) {
    const error = new Error(
      `currencies(${dcaCurrencies.length}) and amounts(${dcaAmounts.length}) length dont match. Please check your DCA_CURRENCIES and DCA_AMOUNTS values`
    );
    console.error(error.message);
    throw error;
  }

  if (!isDcaHour()) {
    console.log('Not executing DCA - current hour not in DCA_EXECUTION_HOURS');
    return;
  }

  const fiatCurrency = 'ZAR';
  const balances = await client.account.getBalances();
  const zarBalance = balances.find((balance) => balance.currency === fiatCurrency);

  if (!zarBalance) {
    const error = new Error(`No ${fiatCurrency} balance found`);
    console.error(error.message);
    throw error;
  }

  const allPairs = await client.public.getCurrencyPairs();
  const pairs = allPairs.reduce(
    (acc, pair) => ({ ...acc, [pair.symbol]: pair }),
    {} as Record<string, (typeof allPairs)[0]>
  );

  // Calculate per-execution amount by dividing by number of execution hours
  // Read fresh from environment to allow dynamic changes without redeployment
  const dcaExecutionHours = process.env.DCA_EXECUTION_HOURS
    ? process.env.DCA_EXECUTION_HOURS.split(',').map((val) => Number(val.trim()))
    : [15];
  const numberOfExecutionHours = dcaExecutionHours.length;
  console.log(
    `DCA configured for ${numberOfExecutionHours} execution hour(s): [${dcaExecutionHours.join(',')}]`
  );

  // Track remaining balance to avoid race conditions when processing multiple currencies
  let remainingBalance = Number(zarBalance.available);
  const orderIds: (string | undefined)[] = [];

  // Process orders sequentially to properly track balance
  for (let index = 0; index < dcaCurrencies.length; index++) {
    const currencyToBuy = dcaCurrencies[index];
    const pair = `${currencyToBuy}${fiatCurrency}`.toUpperCase();
    const pairInfo = pairs[pair];

    if (!pairInfo) {
      console.log(`order book ${pair} does not exist`);
      orderIds.push(undefined);
      continue;
    }

    const totalDcaAmount = dcaAmounts[index];
    if (totalDcaAmount === undefined) {
      console.error(`No DCA amount configured for index ${index}`);
      orderIds.push(undefined);
      continue;
    }

    // Divide the total DCA amount by number of execution hours, rounded to nearest rand
    const dcaAmount = Math.round(totalDcaAmount / numberOfExecutionHours);
    console.log(
      `${currencyToBuy}: Total DCA amount ${totalDcaAmount} ZAR / ${numberOfExecutionHours} execution(s) = ${dcaAmount} ZAR per execution`
    );

    if (remainingBalance < dcaAmount) {
      console.log(
        `Insufficient balance(${remainingBalance}) to buy amount(${dcaAmount}) of currency(${currencyToBuy})`
      );
      orderIds.push(undefined);
      continue;
    }

    if (dcaAmount < Number(pairInfo.minQuoteAmount)) {
      console.log(
        `dcaAmount(${dcaAmount}) too low. require minimum purchase of(${pairInfo.minQuoteAmount})${fiatCurrency}`
      );
      orderIds.push(undefined);
      continue;
    }

    const customerOrderId = getCustomerOrderId(pair);
    if (await hasAlreadyPlacedOrder(customerOrderId)) {
      console.log(`customerOrderId(${customerOrderId}) already exists`);
      orderIds.push(undefined);
      continue;
    }

    const allMarketSummaries = await client.public.getMarketSummary();
    const marketSummary = allMarketSummaries.find((ms) => ms.currencyPair === pair);

    if (!marketSummary) {
      console.log(`No market summary found for ${pair}`);
      orderIds.push(undefined);
      continue;
    }

    console.log(JSON.stringify(marketSummary, null, 2));

    const price = marketSummary.askPrice;
    const amountToBuy = dcaAmount / Number(price);

    if (amountToBuy < Number(pairInfo.minBaseAmount)) {
      console.log(
        `amountToBuy(${amountToBuy}) too low. require minimum base amount(${pairInfo.minBaseAmount})`
      );
      orderIds.push(undefined);
      continue;
    }

    const orderId = await placeBuyOrder(pair, amountToBuy, price, customerOrderId);
    orderIds.push(orderId);

    // Deduct the amount from remaining balance for next iteration
    remainingBalance -= dcaAmount;
  }

  console.log(JSON.stringify(orderIds, null, 2));
}

// CLI entry point for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  buy().catch((error) => {
    console.error('Error occurred while running buy:', error);
    process.exit(1);
  });
}
