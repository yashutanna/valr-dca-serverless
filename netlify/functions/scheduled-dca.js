const { schedule } = require("@netlify/functions");
const buyCrypto = require("../../buy-crypto")
const handler = async function(event, context) {
    console.log("Start scheduled DCA")
    await buyCrypto()
    console.log("Completed scheduled DCA")
    return {
        statusCode: 200,
    };
};

exports.handler = schedule("0 */25 * * *", handler);