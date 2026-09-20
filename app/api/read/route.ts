import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Phrases that indicate a paywall / blocker page
const BLOCK_PATTERNS = [
  /view original article/i,
  /subscribe to continue/i,
  /this content is for subscribers/i,
  /already a subscriber/i,
  /create a free account to continue/i,
  /subscribe now/i,
];

// Truncation markers used by some sites — "loading" placeholders
const TRUNCATION_MARKERS = [
  /טוען\.{2,}/,      // Hebrew: "Loading..."
  /loading\.{2,}/i,  // English: "Loading..."
  /continue reading/i,
  /read more/i,
];

function looksLikeBlocker(text: string): boolean {
  for (const p of BLOCK_PATTERNS) if (p.test(text)) return true;
  return false;
}

function looksTruncated(text: string): boolean {
  for (const p of TRUNCATION_MARKERS) if (p.test(text)) return true;
  return false;
}

function extractArticle(html: string): { title: string; content: string } {
  const $ = cheerio.load(html);
  $(
    'script, style, nav, header, footer, aside, form, iframe, noscript, ' +
      '.ad, .ads, [class*="cookie"], [class*="banner"], [class*="promo"], ' +
      '[class*="subscribe"], [class*="paywall"], [class*="premium"], ' +
      '[class*="comment"], [class*="related"], [class*="recommend"]'
  ).remove();

  const title =
    $('h1').first().text().trim() || $('title').text().trim() || 'Article';

  // Grab the longest run of <p> tags inside a plausible article container
  let bestText = '';
  $(
    'article, main, [role="main"], .article-body, .article__body, ' +
      '.article-content, .post-content, .entry-content, #content, body'
  ).each((_, el) => {
    const txt = $(el)
      .find('p')
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((t) => t.length > 20)
      .join('\n\n');
    if (txt.length > bestText.length) bestText = txt;
  });

  if (bestText.length < 400) {
    bestText = $('p')
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((t) => t.length > 40)
      .join('\n\n');
  }

  if (bestText.length < 200) {
    bestText = $('body').text().replace(/\s+/g, ' ').trim();
  }

  return { title, content: bestText };
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });
  return await res.text();
}

function isGoodArticle(text: string): boolean {
  if (text.length < 400) return false;
  if (looksLikeBlocker(text)) return false;
  if (looksTruncated(text) && text.length < 1500) return false;
  return true;
}

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // 1) Direct
  try {
    const html = await fetchText(url);
    const { title, content } = extractArticle(html);
    if (isGoodArticle(content)) {
      return NextResponse.json({
        title,
        content,
        via: 'direct',
        source: url,
        archiveUrl: `https://archive.ph/newest/${url}`,
      });
    }
  } catch {}

  // 2) Archives
  for (const a of [
    `https://archive.ph/newest/${url}`,
    `https://archive.is/newest/${url}`,
    `https://archive.today/newest/${url}`,
  ]) {
    try {
      const html = await fetchText(a);
      const { title, content } = extractArticle(html);
      if (isGoodArticle(content)) {
        return NextResponse.json({
          title,
          content,
          via: 'archive.today',
          source: url,
          archiveUrl: a,
        });
      }
    } catch {}
  }

  // 3) Wayback
  try {
    const meta = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
    ).then((r) => r.json());
    const snap = meta?.archived_snapshots?.closest?.url;
    if (snap) {
      const html = await fetchText(snap);
      const { title, content } = extractArticle(html);
      if (isGoodArticle(content)) {
        return NextResponse.json({
          title,
          content,
          via: 'wayback',
          source: url,
          archiveUrl: `https://archive.ph/newest/${url}`,
        });
      }
    }
  } catch {}

  return NextResponse.json(
    {
      error:
        'This site is a hard paywall and no full archive snapshot was found. ' +
        'Tap the button to check archive.today manually.',
      archiveUrl: `https://archive.ph/newest/${url}`,
    },
    { status: 400 }
  );
}