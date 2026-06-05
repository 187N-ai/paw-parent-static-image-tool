import { Actor } from 'apify';

await Actor.init();

const input = await Actor.getInput();
const { action, batchName, pageId, apiKey } = input;

const KV_STORE_NAME = 'creative-strategist-config';
const store = await Actor.openKeyValueStore(KV_STORE_NAME);

// ─── STORE OR RETRIEVE ANTHROPIC API KEY ─────────────────
if (action === 'setApiKey') {
    if (!apiKey) {
        await Actor.setValue('OUTPUT', { error: 'No API key provided' });
        await Actor.exit();
        return;
    }
    await store.setValue('ANTHROPIC_API_KEY', apiKey);
    await Actor.setValue('OUTPUT', { success: true, message: 'API key saved' });
    await Actor.exit();
    return;
}

if (action === 'getApiKey') {
    const key = await store.getValue('ANTHROPIC_API_KEY');
    await Actor.setValue('OUTPUT', { apiKey: key || null });
    await Actor.exit();
    return;
}

// ─── NOTION CREDENTIALS ───────────────────────────────────
const NOTION_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_DB_ID || '326b303c3ccc8101aedcff1441fbc9ba';

if (!NOTION_KEY) {
    await Actor.setValue('OUTPUT', { error: 'NOTION_API_KEY environment variable not set' });
    await Actor.exit();
    return;
}

const notionHeaders = {
    'Authorization': `Bearer ${NOTION_KEY}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
};

// ─── SEARCH BATCHES ───────────────────────────────────────
if (action === 'search') {
    if (!batchName) {
        await Actor.setValue('OUTPUT', { error: 'No batchName provided' });
        await Actor.exit();
        return;
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
            filter: {
                property: 'title',
                title: { contains: batchName }
            },
            page_size: 8,
        }),
    });

    const data = await res.json();

    if (data.object === 'error') {
        await Actor.setValue('OUTPUT', { error: data.message });
        await Actor.exit();
        return;
    }

    const results = (data.results || []).map(page => {
        const props = page.properties || {};
        const titleProp = props['Brief Name'] || props['Name'] || props['title'] || {};
        const titleArr = titleProp.title || titleProp.rich_text || [];
        const title = titleArr.map(t => t.plain_text).join('') || page.id;

        const getSelect = key => props[key]?.select?.name || '';
        const getText = key => (props[key]?.rich_text || []).map(t => t.plain_text).join('') || '';

        return {
            id: page.id,
            url: page.url,
            title,
            angle: getText('Angle - Sub-Angle') || getSelect('Angle - Sub-Angle'),
            format: getText('Format') || getSelect('Format'),
            status: getSelect('Status'),
            awareness: getSelect('Awareness Stage'),
        };
    });

    await Actor.setValue('OUTPUT', { results });
    await Actor.exit();
    return;
}

// ─── FETCH FULL PAGE ──────────────────────────────────────
if (action === 'fetchPage') {
    if (!pageId) {
        await Actor.setValue('OUTPUT', { error: 'No pageId provided' });
        await Actor.exit();
        return;
    }

    const cleanId = pageId.replace(/-/g, '');

    const [pageRes, blocksRes] = await Promise.all([
        fetch(`https://api.notion.com/v1/pages/${cleanId}`, { headers: notionHeaders }),
        fetch(`https://api.notion.com/v1/blocks/${cleanId}/children?page_size=100`, { headers: notionHeaders }),
    ]);

    const page = await pageRes.json();
    const blocks = await blocksRes.json();

    if (page.object === 'error') {
        await Actor.setValue('OUTPUT', { error: page.message });
        await Actor.exit();
        return;
    }

    // Extract all text from blocks recursively
    const extractText = (block) => {
        const type = block.type;
        const content = block[type];
        let text = '';

        if (content?.rich_text) {
            text = content.rich_text.map(t => t.plain_text).join('');
        }
        if (content?.caption) {
            text += content.caption.map(t => t.plain_text).join('');
        }

        // Add context markers for key sections
        const headingTypes = ['heading_1', 'heading_2', 'heading_3'];
        if (headingTypes.includes(type) && text) {
            return `\n\n### ${text}\n`;
        }
        if (type === 'paragraph' && text) return `${text}\n`;
        if (type === 'bulleted_list_item' && text) return `• ${text}\n`;
        if (type === 'numbered_list_item' && text) return `${text}\n`;
        if (type === 'quote' && text) return `"${text}"\n`;
        if (type === 'table_row') {
            const cells = content.cells?.map(cell =>
                cell.map(t => t.plain_text).join('')
            ).join(' | ');
            return `${cells}\n`;
        }
        return text ? `${text}\n` : '';
    };

    const pageContent = (blocks.results || []).map(extractText).join('');

    // Extract properties cleanly
    const props = page.properties || {};
    const getProp = (key) => {
        const p = props[key];
        if (!p) return '';
        if (p.title) return p.title.map(t => t.plain_text).join('');
        if (p.rich_text) return p.rich_text.map(t => t.plain_text).join('');
        if (p.select) return p.select.name || '';
        if (p.multi_select) return p.multi_select.map(s => s.name).join(', ');
        if (p.url) return p.url || '';
        if (p.date) return p.date?.start || '';
        if (p.formula) return p.formula?.string || p.formula?.number || '';
        return '';
    };

    const structured = {
        id: page.id,
        url: page.url,
        title: getProp('Brief Name') || getProp('Name'),
        angle: getProp('Angle - Sub-Angle'),
        avatar: getProp('AVATAR'),
        desire: getProp('DESIRE'),
        emotion: getProp('Emotion'),
        awareness: getProp('Awareness Stage'),
        format: getProp('Format'),
        conceptType: getProp('Concept Type'),
        adType: getProp('Ad Type'),
        status: getProp('Status'),
        destination: getProp('Destination'),
        fanpage: getProp('Fanpage'),
        tam: getProp('TAM'),
        testingHypothesis: getProp('TESTING HYPOTHESE'),
        whyItWorked: getProp('Why It Worked / Failed'),
        headline1: getProp('Headline 1'),
        headline2: getProp('Headline 2'),
        headline3: getProp('Headline 3'),
        primaryText1: getProp('Primary Text 1'),
        primaryText2: getProp('Primary Text 2'),
        primaryText3: getProp('Primary Text 3'),
        description1: getProp('Description 1'),
        description2: getProp('Description 2'),
        description3: getProp('Description 3'),
        frameLink: getProp('Link To Frame.io'),
        displayLink: getProp('Display Link'),
        content: pageContent,
    };

    await Actor.setValue('OUTPUT', { page: structured });
    await Actor.exit();
    return;
}

await Actor.setValue('OUTPUT', { error: `Unknown action: ${action}` });
await Actor.exit();
