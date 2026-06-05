# Creative Strategist Tool — The Paw Parent

Batch analysis and static concept generator. Connects to Notion via Apify, analyzes with Claude, outputs designer-ready briefs with full ad copy.

## Repo structure

```
/
├── index.html              ← The tool (open this in a browser or host via GitHub Pages)
└── apify-actor/
    ├── main.js             ← Apify Actor — Notion proxy + API key storage
    ├── package.json
    └── .actor/
        └── actor.json
```

---

## Setup — one time

### 1. Deploy the Apify Actor

1. Log in to [apify.com](https://apify.com)
2. Go to **Actors** → **Create new Actor**
3. Upload or paste the contents of `/apify-actor/` into the Actor source
4. Under **Actor settings → Environment variables**, add:
   - `NOTION_API_KEY` → your Notion integration key (`YOUR_NOTION_API_KEY`)
   - `NOTION_DB_ID` → `326b303c3ccc8101aedcff1441fbc9ba`
5. **Build and deploy** the Actor
6. Go to **API** tab of the Actor → copy the **Run Actor** endpoint URL
7. Also grab your **Apify API token** from your account settings

Your Apify Actor URL will look like:
```
https://api.apify.com/v2/acts/YOUR-USERNAME~creative-strategist-notion-proxy/runs?token=YOUR-TOKEN
```

### 2. Host the tool on GitHub Pages

1. Push this repo to `https://github.com/187N-ai/creative-strategist-tool.git`
2. Go to **Settings → Pages** → Source: **main branch, / (root)**
3. GitHub gives you a URL like `https://187n-ai.github.io/creative-strategist-tool/`

### 3. Open the tool and complete setup

1. Open the GitHub Pages URL
2. Paste your **Apify Actor URL** (with token) into the setup field
3. Paste your **Anthropic API key** (`sk-ant-...`)
4. Click **Save** — stored in browser, only needed once per device

---

## How it works

```
Team opens GitHub Pages URL
        ↓
index.html (hosted on GitHub Pages)
        ↓                        ↓
Anthropic API (direct)    Apify Actor (Notion proxy)
                                 ↓
                     Notion Creative Tracking Board
```

1. **Search** — type a batch number or keyword → Apify searches Notion → matching batches appear
2. **Load** — click a batch → Apify fetches the full Notion page including all properties and content
3. **Analyze** — Claude reads the batch data + landing page knowledge base → auto-fills the entire analysis, selects formats, writes concepts, ad copy, headlines, and descriptions
4. **Review** — correct anything wrong in the UI
5. **Brief** — click Generate Brief → full designer brief with visual spec, copy, and Meta copy ready to copy-paste

---

## Landing page knowledge base

The tool has the full landing page ecosystem built in. When a batch is analyzed, Claude knows:
- Which article the ad is sending traffic to
- Who wrote the article (not always the authority figure in the video)
- What vocabulary the article uses
- What the CTA must set up
- What the static must NOT reveal

This ensures the static concept is always congruent with the landing page.

---

## Copy rules (built into the analysis prompt)

- Direct response tone — every line earns the next
- Broad problem-aware avatar — no sub-avatar-specific language
- No em dashes anywhere
- Sell the click to the article, not the product
- Never name The Paw Parent in ad copy
- Never show the product jar
- Close with a short direct action: "Read it. The link is below."
- No AI tell-tale phrases
