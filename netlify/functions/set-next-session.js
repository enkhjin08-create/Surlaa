// netlify/functions/set-next-session.js
//
// Admin-protected endpoint used by admin.html to schedule the next
// workshop session. Stores { date, time, location } in Netlify Blobs so
// the public landing page can read and display it dynamically.
//
// POST body: { key: "<ADMIN_KEY>", date: "2026-09-20", time: "10:00", location: "Bean Tree Coffee Shop" }

const { getStore } = require('@netlify/blobs');

function getSettingsStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (!siteID || !token) {
    throw new Error('NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN тохируулагдаагүй байна.');
  }
  return getStore({ name: 'settings', siteID, token });
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

  const { key, date, time, location } = payload;

  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Зөвшөөрөлгүй' }) };
  }

  if (!date || !location) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Огноо, байршил шаардлагатай' }) };
  }

  try {
    const store = getSettingsStore();
    const session = {
      date,
      time: time || '',
      location,
      updated_at: new Date().toISOString(),
    };
    await store.setJSON('next-session', session);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
