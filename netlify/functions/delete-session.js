// netlify/functions/delete-session.js
//
// Admin-protected endpoint used by admin.html to remove a session
// (e.g. once it's passed, or was cancelled) from the sessions list.
//
// POST body: { key: "<ADMIN_KEY>", id: "<session id>" }

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

  const { key, id } = payload;

  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Зөвшөөрөлгүй' }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'id шаардлагатай' }) };
  }

  try {
    const store = getSettingsStore();
    const sessions = (await store.get('sessions-list', { type: 'json' })) || [];
    const filtered = sessions.filter(function (s) { return s.id !== id; });
    await store.setJSON('sessions-list', filtered);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: filtered }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
