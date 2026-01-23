# VALR DCA

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yashutanna/valr-dca-serverless)

A simple scheduled script for Dollar Cost Averaging (DCA) your crypto purchases [VALR.com](https://www.valr.com/invite/VAGUBUNX).

When run, this script will use the VALR.com [API](https://docs.valr.com/) to get the account balance for ZAR, check if you have a sufficient balance for your DCA purchase and execute a Limit Post Only Reprice Order on the exchange for the currencies you with to DCA into.

## Why?

VALR offers a convenient way to auto-buy various coins. however, there are a few drawbacks:

- Market buy charges a fee is paid for every time this service is used
- Daily deposits from your bank can cause a noisy transaction history

By bulk depositing ZAR and using the Limit Post Only Reprice order, you are able to earn maker rewards on your daily crypto purchases

## Caveats

Since we are not immediately buying the coin on the market and are placing an order on the order book, its possible that the price moves and your order does not execute.
In this case your order will remain on the order book until the price matches or until you manually cancel the order

# Deploy scheduled task on Netlify

When deployed on Netlify, the script will execute every 25th hour.

## Recommended setup

It is strongly recommended to use a dedicated [sub-account](https://support.valr.com/hc/en-us/articles/4409820263186) for easy accounting.

## VALR API key

In your sub-account, create a new API key with "View" and "Trade" permissions. DO NOT grant withdrawal permissions.
Note the API key and secret.

## Deploy on Netlify

Use the above "Deploy to Netlify" button to deploy on Netlify. Provide the API key and secret in the API_KEY and API_SECRET environment variables, respectively.

If you want to deploy more than one instance of this script, perhaps targeting a different sub-account, you can do so in the Netlify App by clicking "Add new site" and picking "Import an existing project".
Connect to your git provider and pick your fork of this repo, created when you deployed the first instance.
Next, click "Advanced" and then add 5 variables, `API_KEY`, `API_SECRET`, `DCA_EXECUTION_HOURS`, `DCA_CURRENCIES` and `DCA_AMOUNTS`, with your API key and secret, the currencies you wish to DCA into and the amounts in ZAR for each currency.
`DCA_CURRENCIES` and `DCA_AMOUNTS` expect a comma separated list of the same length. The index of the element associates the currency with the amount to buy in ZAR terms. `DCA_EXECUTION_HOURS` accepts comma-separated hours (e.g., "9,15,21") for multiple daily DCA executions - amounts are automatically divided equally across execution times and rounded to the nearest rand. Hours are based on the region your Netlify deployment ends up in (adjust accordingly)
Click "Deploy site". That's it!

## Run with NodeJS

You can run this script directly, without using Netlify:

```bash
API_KEY='your API key here' API_SECRET='your API secret here' DCA_CURRENCIES='ETH' DCA_AMOUNTS='100' node buy-crypto.js
```

## Tip the Developer 🫶

Like this? Please show your gratitude by sending me a tip with VALR Pay.
VALR Pay me here: https://www.valr.com/payments/send?payId=998JWU2ERC2M9ZP8G7HP

Insipired by [nieldw](https://github.com/nieldw/valr-restaking-serverless)
