const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  try {
    const { mode = 'campus', filename = 'image' } = req.query;
    const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
    // Client always sends compressed JPEG; keep original ext only for non-image fallback
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) ? ext : 'jpg';
    const pathname = `backgrounds/${mode}/${Date.now()}.${safeExt}`;
    const contentType = req.headers['content-type'] || 'image/jpeg';

    const blob = await put(pathname, req, { access: 'public', contentType });
    res.json({ url: blob.url });
  } catch(e) {
    console.error('upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
