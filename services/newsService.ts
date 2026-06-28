import fetch from "node-fetch";

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  timestamp: string;
}

const getFallbackNews = (query: string): NewsItem[] => {
  return [
    {
      title: "Global Port Congestion Reaches New Peak in Q2",
      summary: "Major shipping hubs report record delays as consumer demand surges ahead of peak season.",
      url: "https://www.reuters.com",
      source: "Reuters",
      timestamp: new Date().toLocaleDateString()
    },
    {
      title: "New Trade Regulations Impacting Trans-Pacific Routes",
      summary: "Updated customs protocols are causing temporary bottlenecks for electronics and automotive components.",
      url: "https://www.bloomberg.com",
      source: "Bloomberg",
      timestamp: new Date().toLocaleDateString()
    }
  ];
};

export const fetchNewsArticles = async (query: string, pageSize = 5): Promise<NewsItem[]> => {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.warn("[NewsAPI] NEWS_API_KEY is missing from environment. Serving fallback news.");
    return getFallbackNews(query);
  }

  try {
    const cleanQuery = query.trim() || "supply chain disruption";
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(cleanQuery)}&apiKey=${apiKey}&pageSize=${pageSize}&language=en&sortBy=publishedAt`;
    
    console.log(`[NewsAPI] Fetching articles with query: "${cleanQuery}"`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`NewsAPI responded with status ${res.status}`);
    }
    const data: any = await res.json();
    if (data.status !== "ok") {
      throw new Error(data.message || "Failed to fetch from NewsAPI");
    }

    const articles = data.articles || [];
    if (articles.length === 0) {
      console.warn(`[NewsAPI] No articles found for query "${cleanQuery}". Using fallback.`);
      return getFallbackNews(cleanQuery);
    }

    return articles.map((art: any) => ({
      title: art.title || "Untitled Article",
      summary: art.description || art.content || "No summary available.",
      url: art.url || "#",
      source: art.source?.name || "News Source",
      timestamp: art.publishedAt ? new Date(art.publishedAt).toLocaleDateString() : "Recent"
    }));
  } catch (error: any) {
    console.error(`[NewsAPI] Error in fetchNewsArticles:`, error.message || error);
    return getFallbackNews(query);
  }
};

export const fetchRealTimeNews = async (category: string): Promise<NewsItem[]> => {
  const query = category === 'ALL'
    ? '("supply chain" OR "logistics" OR "procurement" OR "manufacturing" OR "shipping" OR "trade" OR "geopolitical risk")'
    : `("supply chain" OR "logistics" OR "shipping") AND ("${category}")`;
  
  return fetchNewsArticles(query, 5);
};
