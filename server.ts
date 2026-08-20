import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import { runSupplierPipeline, runGlobalRiskPipeline } from "./agents/coordinator";
import { generateResourceBriefing, generateResourceDocument } from "./services/resourceAiService";
import { createLogger, setTraceId } from "./lib/logger";
import { newsCache, weatherCache } from "./lib/cache";
import { getSourceCredibility } from "./lib/confidenceEngine";

dotenv.config();

const logger = createLogger('Server');

// ─── News Context Helper (for resource/briefing endpoints) ──────
const fetchNewsContext = async (query: string, pageSize = 3): Promise<{ text: string; apiAvailable: boolean }> => {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return { text: "NEWS_API_KEY not configured.", apiAvailable: false };
  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=${pageSize}&language=en&apiKey=${apiKey}`
    );
    const data: any = await response.json();
    if (!data.articles || data.articles.length === 0) return { text: "No relevant news found.", apiAvailable: true };
    return {
      text: data.articles.map((a: any) =>
        `[${a.source?.name || "News"}] ${a.title}: ${a.description || ""}`
      ).join("\n"),
      apiAvailable: true,
    };
  } catch (err: any) {
    logger.warn("fetchNewsContext", `News context fetch failed: ${err.message}`);
    return { text: `News fetch failed: ${err.message}`, apiAvailable: false };
  }
};

// ─── Timeout Helper ──────────────────────────────────────────────
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      logger.warn("timeout", `Request exceeded ${timeoutMs}ms limit`);
      resolve(fallback);
    }, timeoutMs);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise
  ]);
};

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
  const allowedOrigin = process.env.ALLOWED_ORIGIN;

  if (isProduction && !allowedOrigin) {
    logger.error(
      "startup",
      "CRITICAL CONFIGURATION ERROR: ALLOWED_ORIGIN is unset in non-local/production environment. Deployed frontend CORS requests will fail. Set ALLOWED_ORIGIN to your frontend URL (e.g. https://visor.vercel.app)."
    );
    throw new Error("ALLOWED_ORIGIN environment variable is required in production/Render deployment.");
  }

  logger.info("startup", "Initializing VISOR Intelligence Server...");
  logger.info("startup", "Environment check:", {
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY ? "CONFIGURED" : "MISSING",
    GROQ_API_KEY: process.env.GROQ_API_KEY ? "CONFIGURED" : "MISSING",
    NEWS_API_KEY: process.env.NEWS_API_KEY ? "CONFIGURED" : "MISSING",
    ALLOWED_ORIGIN: allowedOrigin ? allowedOrigin : (isProduction ? "MISSING (FATAL)" : "LOCAL_DEV_DEFAULT"),
  });

  // ─── CORS Middleware ───────────────────────────────────────────
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigin) {
      const allowedOrigins = allowedOrigin.split(",").map(o => o.trim());
      if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
    } else if (!isProduction) {
      res.setHeader("Access-Control-Allow-Origin", origin || "http://localhost:5173");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // ─── Rate Limiting Middleware ──────────────────────────────────
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
  const RATE_LIMIT_MAX = 100; // 100 requests per window

  app.use((req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return next();
    }

    if (record.count >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    }

    record.count += 1;
    next();
  });

  app.use(express.json());

  // ─── Health Check ──────────────────────────────────────────────
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── Weather Alerts (used by dashboard) ────────────────────────
  app.post("/api/weather/alerts", async (req, res) => {
    const { locations } = req.body;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      logger.warn("weather", "OPENWEATHER_API_KEY is missing");
      return res.status(200).json({ alerts: [], apiAvailable: false, error: "OPENWEATHER_API_KEY not configured" });
    }

    if (!locations || !Array.isArray(locations)) {
      return res.status(400).json({ error: "Invalid locations data" });
    }

    try {
      const alerts = await Promise.all(
        locations.map(async (loc: any) => {
          try {
            // Check cache first
            const cacheKey = `w-${loc.lat?.toFixed(2)}-${loc.lon?.toFixed(2)}`;
            const cached = weatherCache.get(cacheKey);
            let data: any;

            if (cached) {
              data = cached;
            } else {
              const url = `https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&appid=${apiKey}&units=metric`;
              const response = await fetch(url);

              if (!response.ok) {
                logger.error("weather-fetch", `OpenWeather API returned ${response.status} for ${loc.name}`);
                return null;
              }

              data = await response.json();
              weatherCache.set(cacheKey, data);
            }

            if (data.weather && data.weather[0]) {
              const condition = data.weather[0].main;
              const description = data.weather[0].description;

              const isDisruptive = ["Thunderstorm", "Snow", "Tornado", "Squall", "Dust", "Sand", "Ash", "Fog"].includes(condition) ||
                (condition === "Rain" && data.rain && data.rain["1h"] > 10) ||
                (data.main?.temp > 40) ||
                (data.wind?.speed > 15);

              if (isDisruptive) {
                return {
                  id: `weather-${loc.name}-${Date.now()}`,
                  title: `Weather Alert: ${condition} in ${loc.name}`,
                  type: "Weather",
                  severity: ["Tornado", "Thunderstorm", "Squall"].includes(condition) || data.wind?.speed > 20 ? "High" : "Medium",
                  location: loc.name,
                  timestamp: new Date().toISOString(),
                  summary: `Severe weather condition (${description}) detected. Potential impact on logistics and supplier operations.`,
                  impactedSuppliers: loc.supplierIds || [],
                  weatherIcon: data.weather[0].icon,
                  verificationStatus: 'verified',
                  confidence: 85,
                };
              }
            }
          } catch (e: any) {
            logger.error("weather-fetch", `Error fetching weather for ${loc.name}: ${e.message}`);
          }
          return null;
        })
      );

      res.json(alerts.filter((a) => a !== null));
    } catch (error: any) {
      logger.error("weather-endpoint", `Weather API error: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  // ─── Current Weather Details ───────────────────────────────────
  app.get("/api/weather/current", async (req, res) => {
    const { lat, lon } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: "Weather API key not configured", apiAvailable: false });
    }

    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    try {
      const cacheKey = `wc-${parseFloat(lat as string).toFixed(2)}-${parseFloat(lon as string).toFixed(2)}`;
      const cached = weatherCache.get(cacheKey);
      if (cached) return res.json(cached);

      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch from OpenWeatherMap");
      }

      const data = await response.json();
      weatherCache.set(cacheKey, data);
      res.json(data);
    } catch (error: any) {
      logger.error("current-weather", `Current weather API error: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch current weather" });
    }
  });

  // ─── Supplier Intelligence (Agent Pipeline) ────────────────────
  app.post("/api/gemini/supplier-intelligence", async (req, res) => {
    const traceId = setTraceId();
    const { supplier, weatherData, isSimulated, relevantDisruptions } = req.body;

    try {
      logger.info("supplier-intel", `Pipeline starting for ${supplier?.name}`, { traceId });

      // Run the full agent pipeline with timeout
      const result = await withTimeout(
        runSupplierPipeline(supplier, req.body.allSuppliers || [supplier], !!isSimulated),
        15000,
        null as any
      );

      if (!result) {
        logger.error("supplier-intel", `Pipeline timed out for ${supplier?.name}`);
        return res.status(504).json({ error: "Intelligence pipeline timed out" });
      }

      // Convert CoordinatorResult to IntelligenceBrief format for backward compatibility
      const brief = {
        supplierId: supplier.id,
        summary: result.briefing.vectorSummary,
        vectorSummary: result.briefing.vectorSummary,
        weatherStatus: result.briefing.weatherStatus,
        suggestedStatus: result.riskScore.level,
        todayFeed: result.briefing.todayFeed,
        recentFeed: result.briefing.recentFeed,
        historicalContext: result.briefing.historicalContext,
        recommendations: result.briefing.mitigationSteps,
        mitigationSteps: result.briefing.mitigationSteps,
        confidenceScore: result.confidenceMetrics.overall.score,
        alternativeSuppliers: result.briefing.alternativeSuppliers,
        lastUpdated: new Date().toISOString(),
        sources: [],
        impactAnalysis: (() => {
          const impact = result.supplyChainOutput.impacts.find(i => i.supplierId === supplier.id);
          return impact ? {
            bottleneck: impact.bottleneck,
            estDelay: impact.estimatedDelay,
            strategicAction: result.briefing.mitigationSteps[0] || 'Monitor situation',
          } : { bottleneck: "None", estDelay: "0h", strategicAction: "Monitor" };
        })(),
        riskScore: result.riskScore,
        confidenceMetrics: result.confidenceMetrics,
      };

      logger.info("supplier-intel", `Pipeline complete for ${supplier?.name}`, {
        traceId,
        latencyMs: result.latencyMs,
        riskScore: result.riskScore.score,
        confidence: result.confidenceMetrics.overall.score,
      });

      res.json(brief);
    } catch (error: any) {
      logger.error("supplier-intel", `Pipeline fatal error: ${error.message}`, {
        traceId,
        error: error.message,
        status: error?.status,
      });
      res.status(500).json({
        error: "Failed to generate supplier intelligence",
        detail: error?.message
      });
    }
  });

  // ─── Global Risk Signals (Agent Pipeline) ──────────────────────
  app.post("/api/gemini/global-risk-signals", async (req, res) => {
    const traceId = setTraceId();
    const { user, suppliers } = req.body;

    try {
      logger.info("global-risk", `Global pipeline starting`, { traceId, supplierCount: suppliers?.length });

      const result = await withTimeout(
        runGlobalRiskPipeline(user, suppliers),
        15000,
        null as any
      );

      if (!result) {
        logger.warn("global-risk", "Global pipeline timed out, returning empty");
        return res.json([]);
      }

      logger.info("global-risk", `Global pipeline complete`, {
        traceId,
        latencyMs: result.latencyMs,
        disruptionCount: result.disruptions.length,
      });

      res.json(result.disruptions);
    } catch (error: any) {
      logger.error("global-risk", `Global pipeline error: ${error.message}`, { traceId });
      res.status(500).json({ error: "Failed to generate global risk signals" });
    }
  });

  // ─── Impact Analysis (uses agent pipeline) ─────────────────────
  app.post("/api/gemini/impact-analysis", async (req, res) => {
    const { supplier, isSimulated } = req.body;
    try {
      const result = await withTimeout(
        runSupplierPipeline(supplier, [supplier], !!isSimulated),
        15000,
        null as any
      );

      if (!result) {
        return res.json({ bottleneck: "Assessment pending", estDelay: "Unknown", strategicAction: "Monitor situation" });
      }

      const impact = result.supplyChainOutput.impacts.find(i => i.supplierId === supplier.id);
      res.json({
        bottleneck: impact?.bottleneck || "No bottleneck detected",
        estDelay: impact?.estimatedDelay || "0h",
        strategicAction: result.briefing.mitigationSteps[0] || "Monitor baseline metrics.",
      });
    } catch (error: any) {
      logger.error("impact-analysis", `Impact analysis error: ${error.message}`);
      res.status(500).json({ error: "Failed to generate impact analysis" });
    }
  });

  // ─── Resource Briefing ─────────────────────────────────────────
  app.post("/api/gemini/resource-briefing", async (req, res) => {
    const { title, location, type, activeDisruptionSummary } = req.body;
    try {
      const result = await withTimeout(
        generateResourceBriefing(title, location, type, activeDisruptionSummary),
        15000,
        {
          summary: activeDisruptionSummary || `Strategic documentation summary for ${title} in ${location}.`,
          keyPoints: ["Intelligence sync pending"],
          status: activeDisruptionSummary ? "Risk Alert" : "Operational Stability"
        }
      );
      res.json(result);
    } catch (error: any) {
      logger.error("resource-briefing", `Resource briefing error: ${error.message}`);
      res.status(500).json({ error: "Failed to generate resource briefing" });
    }
  });

  // ─── Resource Document ─────────────────────────────────────────
  app.post("/api/gemini/resource-document", async (req, res) => {
    const { title, location, type, activeDisruptionSummary } = req.body;
    try {
      const result = await withTimeout(
        generateResourceDocument(title, location, type, activeDisruptionSummary),
        15000,
        {
          title: title || "",
          summary: activeDisruptionSummary || `Standard stability handbook for ${title}.`,
          keyPoints: ["Sync limit reached."],
          executiveSummary: "System response manual compiled offline.",
          detailedAnalysis: "Baseline analytics offline verification.",
          riskAssessment: activeDisruptionSummary || "No probable disruptions found.",
          operationalProtocol: "Standard operating guidelines are active.",
          mitigationStrategies: "Consult offline playbook.",
          classification: "INTERNAL // OFFLINE"
        }
      );
      res.json(result);
    } catch (error: any) {
      logger.error("resource-document", `Resource document error: ${error.message}`);
      res.status(500).json({ error: "Failed to generate resource document" });
    }
  });

  // ─── Connection Check ──────────────────────────────────────────
  app.post("/api/gemini/check", async (req, res) => {
    try {
      const Groq = (await import("groq-sdk")).default;
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
      await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "You are a test assistant." },
          { role: "user", content: "Reply with: ok" },
        ],
        temperature: 0,
        max_tokens: 10,
      });
      res.json({ success: true, message: "Groq connection verified", modelUsed: "openai/gpt-oss-120b" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || "Connection failed" });
    }
  });

  // ─── News Endpoint ─────────────────────────────────────────────
  app.post("/api/news", async (req, res) => {
    const { category } = req.body;
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      // Explicit error — NOT fake articles
      return res.json({
        articles: [],
        apiAvailable: false,
        error: "NEWS_API_KEY not configured. Add it to .env from newsapi.org",
      });
    }

    const query = category === "ALL"
      ? "supply chain disruption logistics shipping"
      : `supply chain disruption logistics ${category}`;
    try {
      // Check cache
      const cacheKey = `news-ep-${category}`;
      const cached = newsCache.get(cacheKey);
      if (cached) return res.json(cached);

      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=6&language=en&apiKey=${apiKey}`
      );
      const data: any = await response.json();

      if (data.status === 'error') {
        return res.status(500).json({ error: `NewsAPI error: ${data.message}`, apiAvailable: false });
      }

      const articles = (data.articles || []).map((a: any) => ({
        title: a.title || "",
        summary: a.description || "",
        url: a.url || "#",
        source: a.source?.name || "NewsAPI",
        sourceCredibility: getSourceCredibility(a.source?.name || ""),
        timestamp: new Date(a.publishedAt).toLocaleTimeString()
      }));

      // Sort by credibility
      articles.sort((a: any, b: any) => b.sourceCredibility - a.sourceCredibility);

      const result = { articles, apiAvailable: true };
      newsCache.set(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      logger.error("news-endpoint", `NewsAPI error: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch news", apiAvailable: false });
    }
  });

  // ─── News Search ───────────────────────────────────────────────
  app.post("/api/news/search", async (req, res) => {
    const { query, pageSize = 5 } = req.body;
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return res.json({ articles: [], apiAvailable: false, error: "NEWS_API_KEY not configured" });
    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=${pageSize}&language=en&apiKey=${apiKey}`
      );
      const data: any = await response.json();
      const articles = (data.articles || []).map((a: any) => ({
        title: a.title || "",
        summary: a.description || "",
        url: a.url || "#",
        source: a.source?.name || "NewsAPI",
        sourceCredibility: getSourceCredibility(a.source?.name || ""),
        timestamp: new Date(a.publishedAt).toLocaleTimeString()
      }));
      res.json({ articles, apiAvailable: true });
    } catch (error: any) {
      logger.error("news-search", `NewsAPI search error: ${error.message}`);
      res.status(500).json({ error: "Failed to search news", apiAvailable: false });
    }
  });

  // ─── Vite Middleware ───────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  await app.listen(PORT, "0.0.0.0");
  logger.info("startup", `VISOR Intelligence Server running on http://localhost:${PORT}`);
}

startServer();
