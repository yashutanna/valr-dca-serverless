const {getHeaders} = require('./auth');
const dcaCurrencies = process.env.DCA_CURRENCIES?.split(',').map(val => val.trim()) || [] // example: BTC,ETH
const dcaAmounts = process.env.DCA_AMOUNTS?.split(',').map(val => val.trim()) || [] // example: 100,50

async function placeBuyOrder(pair, amount, price) {
    console.log(`Placing Limit Post Only Reprice order of ${amount} on pair ${pair}`);
    let timestamp = (new Date()).getTime();
    const body = {
        "side": "BUY",
        "quantity": amount,
        "price": price,
        "pair": pair,
        "postOnly": false,
        "postOnlyReprice": true,
        "postOnlyRepriceTicks": "1",
        "customerOrderId": "postOnlyReprice",
        "timeInForce": "GTC"
    };
    const options = {
        method: "POST",
        body: JSON.stringify(body),
        headers: getHeaders(timestamp, "POST", "/v1/orders/limit", JSON.stringify(body))
    };
    const response = await fetch('https://api.valr.com/v1/orders/limit', options);
    const json = await response.json();
    return json.id;
}

const getBalances = async () => {
    let timestamp = (new Date()).getTime();
    let options = {
        method: "GET",
        headers: getHeaders(timestamp, "GET", "/v1/account/balances?excludeZeroBalances=true"),
    };
    const response = await fetch('https://api.valr.com/v1/account/balances?excludeZeroBalances=true', options);
    return await response.json();
}
const getAllPairs = async () => {
    let options = {
        method: "GET",
    };
    const response = await fetch('https://api.valr.com/v1/public/pairs', options);
    const allPairs = await response.json();
    return allPairs.reduce((acc, pair) => ({...acc, [pair.symbol]: pair}), {})
}
const getBestBid = async (pair) => {
    let options = {
        method: "GET",
    };
    const response = await fetch(`https://api.valr.com/v1/public/${pair}/marketsummary`, options);
    const marketSummary = await response.json();
    return marketSummary.bidPrice;
}

const buy = async () => {
    try {
        if(dcaCurrencies.length !== dcaAmounts.length){
            console.error('currencies and amounts length dont match. Please check your DCA_CURRENCIES and DCA_AMOUNTS values')
        }
        const fiatCurrency = 'ZAR'
        const balances = await getBalances();
        const zarBalance = balances.find(balance => balance.currency === fiatCurrency);
        const pairs = await getAllPairs();

        const buyPromises = dcaCurrencies.map(async (currencyToBuy, index) => {
            const pair = `${currencyToBuy}${fiatCurrency}`.toUpperCase()
            if(!pairs[pair]){
                // do nothing if there is no orderbook for the pair
                console.log(`order book ${orderBook} does not exist`);
                return;
            }
            if(Number(zarBalance.available) < Number(dcaAmounts[index])){
                // do nothing if there is not sufficient balance
                console.log(`Insufficient balance(${zarBalance}) to buy amount(${dcaAmounts[index]}) of currency(${currencyToBuy})`);
                return;
            }
            if(dcaAmounts[index] < pairs[pair].minQuoteAmount){
                // do nothing if there is not sufficient balance
                console.log(`dcaAmount(${dcaAmounts[index]}) too low. require minimum purchase of(${pairs[pair].minQuoteAmount})${fiatCurrency}`);
                return;
            }
            const bestBid = await getBestBid(pair)
            const amountToBuy = Number(dcaAmounts[index]) / Number(bestBid);
            if(amountToBuy < pairs[pair].minBaseAmount){
                // do nothing if there is not sufficient balance
                console.log(`amountToBuy(${amountToBuy}) too low. require minimum base amount(${pairs[pair].minBaseAmount})`);
                return;
            }
            return placeBuyOrder(pair, amountToBuy, bestBid);
        });

        const orderIds = await Promise.all(buyPromises);
        console.log(JSON.stringify(orderIds, null, 2))
    } catch (error) {
        console.log(error);
    }
};

if (require.main === module) {
    // This code will only run if the file is executed directly with Node.js
    buy().catch(error => {
        console.error('Error occurred while running buy:', error);
        process.exit(1); // Exit with a non-zero status code to indicate an error
    });
}

module.exports = buy;