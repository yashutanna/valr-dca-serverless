import { ValrClient } from 'valr-typescript-client';
import type { EnvConfig } from './types.js';

// Environment variable parsing with validation
function getEnvConfig(): EnvConfig {
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('API_KEY and API_SECRET environment variables are required');
  }

  const dcaHourExecution = Number(process.env.DCA_EXECUTION_HOUR) || 15;
  const dcaCurrencies = process.env.DCA_CURRENCIES?.split(',').map((val) => val.trim()) || [];
  const dcaAmounts = process.env.DCA_AMOUNTS?.split(',').map((val) => Number(val.trim())) || [];

  return {
    API_KEY: apiKey,
    API_SECRET: apiSecret,
    DCA_EXECUTION_HOUR: dcaHourExecution,
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
  const dcaHour = Number(process.env.DCA_EXECUTION_HOUR) || 15;
  const currentHour = new Date().getHours();
  console.log(`Checking DCA hour: current=${currentHour}, configured=${dcaHour}`);
  return currentHour === dcaHour;
}

function getCustomerOrderId(pair: string): string {
  const now = new Date();
  const date = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Removed hour to ensure only ONE order per day (not per hour)
  // This prevents duplicate DCA executions even if function runs multiple times per day
  return `${pair}-${year}-${month}-${date}`;
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
  console.log(`Placing Limit Post Only Reprice order of ${amount} on pair ${pair}`);

  const response = await client.trading.placeLimitOrder({
    side: 'BUY',
    quantity: amount.toString(),
    price: price,
    pair: pair,
    customerOrderId: customerOrderId,
    timeInForce: 'GTC',
  });

  console.log(JSON.stringify(response, null, 2));
  return response.id;
}

export async function buy(): Promise<void> {
  try {
    if (config.DCA_CURRENCIES.length !== config.DCA_AMOUNTS.length) {
      console.error(
        `currencies(${config.DCA_CURRENCIES.length}) and amounts(${config.DCA_AMOUNTS.length}) length dont match. Please check your DCA_CURRENCIES and DCA_AMOUNTS values`
      );
      return;
    }

    if (!isDcaHour()) {
      console.log('Not executing DCA - current hour does not match DCA_EXECUTION_HOUR');
      return;
    }

    const fiatCurrency = 'ZAR';
    const balances = await client.account.getBalances();
    const zarBalance = balances.find((balance) => balance.currency === fiatCurrency);

    if (!zarBalance) {
      console.error(`No ${fiatCurrency} balance found`);
      return;
    }

    const allPairs = await client.public.getCurrencyPairs();
    const pairs = allPairs.reduce(
      (acc, pair) => ({ ...acc, [pair.symbol]: pair }),
      {} as Record<string, (typeof allPairs)[0]>
    );

    const buyPromises = config.DCA_CURRENCIES.map(async (currencyToBuy, index) => {
      const pair = `${currencyToBuy}${fiatCurrency}`.toUpperCase();
      const pairInfo = pairs[pair];

      if (!pairInfo) {
        console.log(`order book ${pair} does not exist`);
        return;
      }

      const dcaAmount = config.DCA_AMOUNTS[index];
      if (dcaAmount === undefined) {
        console.error(`No DCA amount configured for index ${index}`);
        return;
      }

      if (Number(zarBalance.available) < dcaAmount) {
        console.log(
          `Insufficient balance(${zarBalance.available}) to buy amount(${dcaAmount}) of currency(${currencyToBuy})`
        );
        return;
      }

      if (dcaAmount < Number(pairInfo.minQuoteAmount)) {
        console.log(
          `dcaAmount(${dcaAmount}) too low. require minimum purchase of(${pairInfo.minQuoteAmount})${fiatCurrency}`
        );
        return;
      }

      const customerOrderId = getCustomerOrderId(pair);
      if (await hasAlreadyPlacedOrder(customerOrderId)) {
        console.log(`customerOrderId(${customerOrderId}) already exists`);
        return;
      }

      const allMarketSummaries = await client.public.getMarketSummary();
      const marketSummary = allMarketSummaries.find((ms) => ms.currencyPair === pair);

      if (!marketSummary) {
        console.log(`No market summary found for ${pair}`);
        return;
      }

      console.log(JSON.stringify(marketSummary, null, 2));

      const price = marketSummary.askPrice;
      const amountToBuy = dcaAmount / Number(price);

      if (amountToBuy < Number(pairInfo.minBaseAmount)) {
        console.log(
          `amountToBuy(${amountToBuy}) too low. require minimum base amount(${pairInfo.minBaseAmount})`
        );
        return;
      }

      return placeBuyOrder(pair, amountToBuy, price, customerOrderId);
    });

    const orderIds = await Promise.all(buyPromises);
    console.log(JSON.stringify(orderIds, null, 2));
  } catch (error) {
    console.log(error);
  }
}

// CLI entry point for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  buy().catch((error) => {
    console.error('Error occurred while running buy:', error);
    process.exit(1);
  });
}
