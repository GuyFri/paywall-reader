'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [article, setArticle] = useState<{ content: string; via?: string } | null>(null);
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
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-sm">
          <button
            onClick={() => setArticle(null)}
            className="mb-6 text-blue-600 hover:underline text-sm"
          >
            ← Read another article
          </button>
          {article.via && (
            <p className="text-xs text-gray-400 mb-4">Source: {article.via}</p>
          )}
          <div className="prose prose-lg text-gray-800 leading-relaxed whitespace-pre-wrap">
            {article.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">
          Paywall Reader
        </h1>

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
          {loading ? 'Fetching (direct + archives)...' : 'Read Article'}
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
          Tries direct fetch, then archive.today, then Wayback automatically.
        </p>
      </div>
    </div>
  );
}