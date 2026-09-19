import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

async function fetchText(url: string, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
      ...extraHeaders,
    },
    redirect: 'follow',
  });
  return await res.text();
}

function extractArticle(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, form, iframe, noscript').remove();
  // Prefer common article containers, fall back to body
  const candidates = [
    'article',
    'main',
    '[role="main"]',
    '.article-body',
    '.article__body',
    '.post-content',
    '.entry-content',
    '#content',
    'body',
  ];
  for (const sel of candidates) {
    const txt = $(sel).text().replace(/\s+/g, ' ').trim();
    if (txt.length > 400) return txt;
  }
  return '';
}

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // 1) Try the original page
  try {
    const html = await fetchText(url);
    const text = extractArticle(html);
    if (text.length >= 400) {
      return NextResponse.json({ content: text, source: url, via: 'direct' });
    }
  } catch {
    // fall through to archives
  }

  // 2) Try archive.today (multiple mirrors + newest-snapshot endpoint)
  const archiveUrls = [
    `https://archive.ph/newest/${url}`,
    `https://archive.today/newest/${url}`,
    `https://archive.is/newest/${url}`,
  ];
  for (const a of archiveUrls) {
    try {
      const html = await fetchText(a);
      // If archive.today has no snapshot, it shows a form/search page
      if (/No results|not archived|not been archived/i.test(html)) continue;
      // archive.ph may redirect to the snapshot URL; extract text
      const text = extractArticle(html);
      if (text.length >= 400) {
        return NextResponse.json({ content: text, source: url, via: 'archive.today' });
      }
    } catch {
      // try next mirror
    }
  }

  // 3) Try the Wayback Machine
  try {
    const waybackApi = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const meta = await fetch(waybackApi).then((r) => r.json());
    const snap = meta?.archived_snapshots?.closest?.url;
    if (snap) {
      const html = await fetchText(snap);
      const text = extractArticle(html);
      if (text.length >= 400) {
        return NextResponse.json({ content: text, source: url, via: 'wayback' });
      }
    }
  } catch {
    // ignore
  }

  // 4) Nothing worked
  return NextResponse.json(
    {
      error: 'Could not find the article in any archive. Try opening it manually.',
      archiveUrl: `https://archive.ph/newest/${url}`,
    },
    { status: 400 }
  );
}
