const crypto = require('crypto');
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;

function signRequest(apiSecret, timestamp, verb, path, body = '') {
    return crypto
        .createHmac("sha512", apiSecret)
        .update(timestamp.toString())
        .update(verb.toUpperCase())
        .update(path)
        .update(body)
        .digest("hex");
}

function getHeaders(timestamp, verb, path, body = '') {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "X-VALR-API-KEY": `${apiKey}`,
        "X-VALR-SIGNATURE": `${signRequest(apiSecret, timestamp, verb, path, body)}`,
        "X-VALR-TIMESTAMP": `${timestamp}`
    };
}

module.exports = {
    signRequest,
    getHeaders
}