const { list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  try {
    const { mode = 'campus' } = req.query;
    const { blobs } = await list({ prefix: `backgrounds/${mode}/` });
    res.setHeader('Cache-Control', 'no-store');
    res.json(blobs.map(b => b.url));
  } catch(e) {
    console.error('list error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
