// netlify/functions/qpay-webhook.js
//
// QPay calls this URL automatically when a payment completes (the
// callback_url passed when creating the invoice). The browser also polls
// qpay-check-payment on its own, so this webhook is a nice-to-have speed
// boost, not a requirement — registration still confirms correctly even if
// this never fires.
//
// QPay expects a fast 200 OK response regardless of what you do with the data.

exports.handler = async (event) => {
  console.log('QPay webhook received:', event.queryStringParameters, event.body);
  return { statusCode: 200, body: 'ok' };
};
