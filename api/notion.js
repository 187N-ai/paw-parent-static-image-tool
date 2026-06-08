// Vercel serverless function — read-only Notion proxy for the static image tool.
//
// Why this exists:
//   • Notion's REST API blocks direct browser (cross-origin) requests, so the
//     client cannot call api.notion.com itself ("Failed to fetch" / CORS).
//   • The Notion integration token must stay server-side, never shipped in the
//     public client bundle.
//
// Setup: in Vercel → Settings → Environment Variables, add:
//   NOTION_KEY   = <your Notion integration token>   (required)
//   NOTION_DB_ID = <Creative Tracking Board db id>   (optional; falls back below)
//
// Only three read operations are exposed (query the board, read a page, read a
// page's blocks) so the deployed endpoint can't be used as a general Notion proxy.

const NOTION_DB_ID = process.env.NOTION_DB_ID || '326b303c3ccc8101aedcff1441fbc9ba';
const NOTION_VERSION = '2022-06-28';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed — use POST.' });
    return;
  }

  const NOTION_KEY = process.env.NOTION_KEY;
  if (!NOTION_KEY) {
    res.status(500).json({
      error: 'NOTION_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.'
    });
    return;
  }

  const headers = {
    'Authorization': 'Bearer ' + NOTION_KEY,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };

  // Vercel parses JSON bodies automatically; guard for the string case anyway.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { op, id, query, children } = body || {};

  let url, options;
  if (op === 'create') {
    if (!body.properties || typeof body.properties !== 'object') {
      res.status(400).json({ error: 'create requires a properties object.' }); return;
    }
    const payload = { parent: { database_id: NOTION_DB_ID }, properties: body.properties };
    if (Array.isArray(body.children) && body.children.length) payload.children = body.children.slice(0, 100);
    url = 'https://api.notion.com/v1/pages';
    options = { method: 'POST', headers, body: JSON.stringify(payload) };
  } else if (op === 'append') {
    if (!id) { res.status(400).json({ error: 'Missing id for op=append.' }); return; }
    if (!Array.isArray(children) || children.length === 0 || children.length > 100) {
      res.status(400).json({ error: 'append requires 1-100 children blocks.' }); return;
    }
    url = `https://api.notion.com/v1/blocks/${encodeURIComponent(id)}/children`;
    options = { method: 'PATCH', headers, body: JSON.stringify({ children }) };
  } else if (op === 'query') {
    url = `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`;
    options = {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: { property: 'title', title: { contains: query || '' } },
        page_size: 8
      })
    };
  } else if (op === 'page') {
    if (!id) { res.status(400).json({ error: 'Missing id for op=page.' }); return; }
    url = `https://api.notion.com/v1/pages/${encodeURIComponent(id)}`;
    options = { method: 'GET', headers };
  } else if (op === 'blocks') {
    if (!id) { res.status(400).json({ error: 'Missing id for op=blocks.' }); return; }
    url = `https://api.notion.com/v1/blocks/${encodeURIComponent(id)}/children?page_size=100`;
    options = { method: 'GET', headers };
  } else {
    res.status(400).json({ error: 'Unknown op: ' + op + '. Expected query | page | blocks | append | create.' });
    return;
  }

  try {
    const r = await fetch(url, options);
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: 'Proxy error reaching Notion: ' + (e && e.message ? e.message : String(e)) });
  }
}
