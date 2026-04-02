const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let events = [];
    let source = '';

    /* ── Strategy 1: CampusLabs structured JSON API ── */
    try {
      const now = new Date().toISOString();
      const clUrl =
        `https://umb.campuslabs.com/engage/api/discovery/event/search` +
        `?take=15&query=&orderByField=StartDateTime&orderByDirection=ascending` +
        `&status=Approved&startDate=${encodeURIComponent(now)}`;

      const clRes = await fetch(clUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'UMBDashboard/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (clRes.ok) {
        const data = await clRes.json();
        if (Array.isArray(data.value) && data.value.length > 0) {
          events = data.value.slice(0, 12).map(e => {
            const start = e.startsOn || e.StartsOn || '';
            const d = start ? new Date(start) : null;
            return {
              title:       e.name || e.Name || 'Event',
              date:        start ? start.split('T')[0] : '',
              time:        d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
              location:    e.location || e.Location || '',
              description: (e.description || e.Description || '').replace(/<[^>]*>/g, '').substring(0, 120),
            };
          });
          source = 'campuslabs';
        }
      }
    } catch (_) { /* fall through */ }

    /* ── Strategy 2: Scrape UMB events page → Claude parse ── */
    if (!events.length) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ events: [], error: 'ANTHROPIC_API_KEY not set', source: 'none' });
      }

      const pageRes = await fetch('https://www.umb.edu/events/events-calendar/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UMBDashboard/1.0)' },
        signal: AbortSignal.timeout(12000),
      });
      const html = await pageRes.text();

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content:
            `Extract all upcoming events from this HTML. ` +
            `Return a JSON array — each item must have: title (string), date (YYYY-MM-DD), time (string, e.g. "2:00 PM"), location (string), description (string ≤120 chars). ` +
            `Only include events on or after today. If none found, return []. ` +
            `Return ONLY the JSON array, no markdown, no explanation.\n\n` +
            `Today: ${new Date().toISOString().split('T')[0]}\n\n` +
            `HTML (first 60 000 chars):\n${html.substring(0, 60000)}`,
        }],
      });

      const raw = msg.content[0].text.trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try { events = JSON.parse(jsonMatch[0]); source = 'umb-scrape'; } catch (_) {}
      }
    }

    return res.status(200).json({
      events,
      source,
      count: events.length,
      updated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('events handler error:', error);
    return res.status(500).json({ events: [], error: error.message, source: 'error' });
  }
};
