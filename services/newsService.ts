/**
 * VISOR News Service (Client-Side)
 * Fetches news through the server proxy.
 * NEVER returns fake/fabricated articles — explicitly surfaces API failures.
 */

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  timestamp: string;
  sourceCredibility?: number;
}

export interface NewsResponse {
  articles: NewsItem[];
  apiAvailable: boolean;
  error?: string;
}

export const fetchRealTimeNews = async (category: string): Promise<NewsResponse> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Server returned status ${res.status}`);
    const data = await res.json();

    // Handle both old format (array) and new format (object with articles)
    if (Array.isArray(data)) {
      return { articles: data, apiAvailable: true };
    }
    return data as NewsResponse;
  } catch (e: any) {
    console.error("Failed to fetch news:", e.message);
    // NEVER return fake articles — surface the failure explicitly
    return {
      articles: [],
      apiAvailable: false,
      error: e.name === 'AbortError' ? 'News request timed out' : `News fetch failed: ${e.message}`,
    };
  }
};

export const fetchNewsArticles = async (query: string, pageSize = 5): Promise<NewsResponse> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch("/api/news/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, pageSize }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Server returned status ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      return { articles: data, apiAvailable: true };
    }
    return data as NewsResponse;
  } catch (e: any) {
    console.error("Failed to fetch news articles:", e.message);
    return {
      articles: [],
      apiAvailable: false,
      error: e.name === 'AbortError' ? 'Search request timed out' : `Search failed: ${e.message}`,
    };
  }
};
