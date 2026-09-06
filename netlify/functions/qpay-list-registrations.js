// netlify/functions/qpay-list-registrations.js
//
// Simple admin view: GET /.netlify/functions/qpay-list-registrations?key=YOUR_ADMIN_KEY
// Returns all stored registrations with their payment status.
//
// Required environment variable:
//   ADMIN_KEY — a password of your choosing; only requests with the matching
//               ?key= query param are allowed through.

const { getStore } = require('@netlify/blobs');

function getRegistrationsStore() {
  return getStore({
    name: 'registrations',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Зөвшөөрөлгүй' }) };
  }

  try {
    const store = getRegistrationsStore();
    const { blobs } = await store.list();
    const records = await Promise.all(
      blobs.map(async (b) => {
        const data = await store.get(b.key, { type: 'json' });
        return { invoice_id: b.key, ...data };
      })
    );
    records.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: records.length, registrations: records }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
