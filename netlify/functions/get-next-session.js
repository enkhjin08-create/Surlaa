// netlify/functions/get-next-session.js
//
// Public, read-only endpoint. Returns the next workshop session info that
// the admin has set via set-next-session.js, so the landing page can show
// it dynamically instead of a hardcoded date.

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
    const session = await store.get('next-session', { type: 'json' });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session || null),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    };
  }
};
