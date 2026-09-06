// netlify/functions/qpay-create-invoice.js
//
// Creates a QPay invoice for a workshop registration and stores the
// registration (pending payment) in Netlify Blobs, keyed by invoice_id.
//
// Required environment variables (set in Netlify: Site configuration →
// Environment variables):
//   QPAY_USERNAME         — QPay merchant username
//   QPAY_PASSWORD         — QPay merchant password
//   QPAY_INVOICE_CODE     — QPay invoice code assigned to your merchant account
//   NETLIFY_SITE_ID       — Site configuration → General → Site details → Site ID
//   NETLIFY_BLOBS_TOKEN   — User settings → Applications → Personal access tokens → New access token
//
// The NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN pair is only needed because this
// site is deployed via manual drag-and-drop (not a Git-linked site) — Netlify
// Blobs can't auto-detect site credentials in that case, so we pass them in.
//
// QPay credentials come from registering as a merchant at https://qpay.mn
// and requesting API access.

const { getStore } = require('@netlify/blobs');

const QPAY_BASE = 'https://merchant.qpay.mn/v2';
const AMOUNT = 500000;

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
  if (!res.ok) {
    throw new Error(`QPay auth failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Буруу хүсэлт' }) };
  }

  const { name, phone, email, goal, business } = payload;
  if (!name || !phone || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Нэр, утас, имэйл шаардлагатай' }) };
  }

  try {
    const token = await getQpayToken();
    const senderInvoiceNo = 'SURLAA-' + Date.now();
    const siteUrl = process.env.URL || '';

    const invoiceRes = await fetch(`${QPAY_BASE}/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        invoice_code: process.env.QPAY_INVOICE_CODE,
        sender_invoice_no: senderInvoiceNo,
        invoice_receiver_code: 'terminal',
        invoice_description: `Surlaa.today семинар — ${name}`,
        amount: AMOUNT,
        callback_url: `${siteUrl}/.netlify/functions/qpay-webhook`,
      }),
    });

    const invoice = await safeJson(invoiceRes, 'QPay invoice create');
    if (!invoiceRes.ok) {
      throw new Error(`QPay invoice failed (${invoiceRes.status}): ${JSON.stringify(invoice)}`);
    }

    const store = getRegistrationsStore();
    await store.setJSON(invoice.invoice_id, {
      name,
      phone,
      email,
      goal: goal || '',
      business: business || '',
      sender_invoice_no: senderInvoiceNo,
      amount: AMOUNT,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: invoice.invoice_id,
        qr_image: invoice.qr_image,
        qr_text: invoice.qr_text,
        qpay_shorturl: invoice.qPay_shortUrl || invoice.qPay_shorturl || null,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
