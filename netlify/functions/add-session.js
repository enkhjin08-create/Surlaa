// netlify/functions/add-session.js
//
// Admin-protected endpoint used by admin.html to add a new upcoming
// workshop session to the list. Sessions are stored as an array in
// Netlify Blobs so more than one date can be open for registration
// at the same time.
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

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
    const sessions = (await store.get('sessions-list', { type: 'json' })) || [];

    sessions.push({
      id: makeId(),
      date,
      time: time || '',
      location,
      created_at: new Date().toISOString(),
    });

    await store.setJSON('sessions-list', sessions);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
