// netlify/functions/get-sessions.js
//
// Public, read-only endpoint. Returns the full list of scheduled workshop
// sessions (past and future) so the landing page can offer a choice of
// dates at registration time.

const { getStore } = require('@netlify/blobs');

function getSettingsStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (!siteID || !token) {
    throw new Error('NETLIFY_SITE_ID / NETLIFY_BLOBS_TOKEN тохируулагдаагүй байна.');
  }
  return getStore({ name: 'settings', siteID, token });
}

exports.handler = async () => {
  try {
    const store = getSettingsStore();
    const sessions = (await store.get('sessions-list', { type: 'json' })) || [];
    sessions.sort(function (a, b) {
      return (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: sessions }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: [] }),
    };
  }
};
