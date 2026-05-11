const { del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const { url } = JSON.parse(Buffer.concat(chunks).toString());

  if (!url || !url.includes('vercel-storage.com')) {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  await del(url);
  res.json({ ok: true });
};
