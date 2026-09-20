'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [article, setArticle] = useState<{
    title?: string;
    content: string;
    via?: string;
    archiveUrl?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [archiveUrl, setArchiveUrl] = useState('');

  const handleRead = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setArchiveUrl('');
    setArticle(null);

    try {
      const res = await fetch('/api/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch article.');
        if (data.archiveUrl) setArchiveUrl(data.archiveUrl);
      } else {
        setArticle(data);
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (article) {
    const isRTL = /[\u0590-\u05FF\u0600-\u06FF]/.test(article.content);

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setArticle(null)}
              className="text-blue-600 hover:underline text-sm"
            >
              ← Read another
            </button>
            <a
              href={article.archiveUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="text-sm bg-amber-100 text-amber-800 px-3 py-1 rounded hover:bg-amber-200"
            >
              Try archive ↗
            </a>
          </div>

          {article.via && (
            <p className="text-xs text-gray-400 mb-4">Source: {article.via}</p>
          )}

          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className="text-gray-800 whitespace-pre-wrap"
            style={{
              fontSize: '19px',
              lineHeight: 1.8,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {article.content}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3">
              Article ended here? This site may have sent only a preview.
            </p>
            <a
              href={article.archiveUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center bg-blue-600 text-white p-3 rounded font-medium hover:bg-blue-700"
            >
              Open full version on archive.today ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-900">
          Unblock Reader
        </h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Paste any article link to read it without paywalls.
        </p>

        <input
          type="url"
          placeholder="Paste article link here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />

        <button
          onClick={handleRead}
          disabled={loading || !url}
          className="w-full bg-blue-600 text-white p-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? 'Fetching…' : 'Read Article'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
            {archiveUrl && (
              <p className="mt-3">
                <a
                  href={archiveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block bg-blue-600 text-white px-3 py-2 rounded font-medium"
                >
                  Open in archive.today
                </a>
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500 text-center">
          Tries direct → archive.today → Wayback automatically.
        </p>
      </div>
    </div>
  );
}