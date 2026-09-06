// netlify/functions/qpay-check-payment.js
//
// Polled by the browser every few seconds while the QR is on screen.
// Checks QPay for payment, and marks the stored registration as paid.

const { getStore } = require('@netlify/blobs');

const QPAY_BASE = 'https://merchant.qpay.mn/v2';

function getRegistrationsStore() {
  return getStore({
    name: 'registrations',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

async function safeJson(res, label) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label} returned non-JSON (status ${res.status}, content-type ${res.headers.get('content-type')}): ${text.slice(0, 200)}`);
  }
}

async function getQpayToken() {
  const auth = Buffer.from(`${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`).toString('base64');
  const res = await fetch(`${QPAY_BASE}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
  });
  const data = await safeJson(res, 'QPay auth');
  if (!res.ok) throw new Error(`QPay auth failed (${res.status}): ${JSON.stringify(data)}`);
  return data.access_token;
}

exports.handler = async (event) => {
  const invoiceId = event.queryStringParameters && event.queryStringParameters.invoice_id;
  if (!invoiceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invoice_id шаардлагатай' }) };
  }

  try {
    const store = getRegistrationsStore();
    const record = await store.get(invoiceId, { type: 'json' });

    if (!record) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Олдсонгүй' }) };
    }

    if (record.status === 'paid') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: true }) };
    }

    const token = await getQpayToken();
    const checkRes = await fetch(`${QPAY_BASE}/payment/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      }),
    });

    const checkData = await safeJson(checkRes, 'QPay payment check');
    if (!checkRes.ok) {
      throw new Error(`QPay check failed (${checkRes.status}): ${JSON.stringify(checkData)}`);
    }
    const paid = (checkData.count || 0) > 0;

    if (paid) {
      record.status = 'paid';
      record.paid_at = new Date().toISOString();
      await store.setJSON(invoiceId, record);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
