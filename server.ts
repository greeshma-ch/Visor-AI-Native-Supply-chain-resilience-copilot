import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import path from "path";
import fetch from "node-fetch";
import { generateSupplierIntelligence, generateGlobalRiskSignals } from "./services/geminiService";
import { generateResourceBriefing, generateResourceDocument } from "./services/resourceAiService";
import { fetchRealTimeNews } from "./services/newsService";

// ─── CORS ────────────────────────────────────────────────────────────────────
// Allow your Vercel frontend + localhost dev. Add your Vercel URL to
// ALLOWED_ORIGIN in Render's environment variables.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";

const corsMiddleware = (req: any, res: any, next: any) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
};

// ─── Timeout helper ───────────────────────────────────────────────────────────
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Timeout] Request exceeded ${timeoutMs}ms`);
      resolve(fallback);
    }, timeoutMs);
  });
  return Promise.race([
    promise.then((res) => { clearTimeout(timeoutId); return res; }),
    timeoutPromise
  ]);
};

async function startServer() {
  const app = express();

  console.log("Initializing VISOR Intelligence Server...");
  console.log("- GROQ_API_KEY:", process.env.GROQ_API_KEY ? "CONFIGURED" : "MISSING");
  console.log("- NEWS_API_KEY:", process.env.NEWS_API_KEY ? "CONFIGURED" : "MISSING");
  console.log("- OPENWEATHER_API_KEY:", process.env.OPENWEATHER_API_KEY ? "CONFIGURED" : "MISSING");
  console.log("- ALLOWED_ORIGIN:", ALLOWED_ORIGIN);

  app.use(corsMiddleware);
  app.use(express.json());

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Weather alerts ─────────────────────────────────────────────────────────
  app.post("/api/weather/alerts", async (req, res) => {
    const { locations } = req.body;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return res.status(200).json([]);
    if (!locations || !Array.isArray(locations)) return res.status(400).json({ error: "Invalid locations" });

    try {
      const alerts = await Promise.all(
        locations.map(async (loc: any) => {
          try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&appid=${apiKey}&units=metric`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const data: any = await response.json();
            if (data.weather && data.weather[0]) {
              const condition = data.weather[0].main;
              const isDisruptive = ["Thunderstorm", "Snow", "Tornado", "Squall", "Dust", "Sand", "Ash"].includes(condition) ||
                (condition === "Rain" && data.rain && data.rain["1h"] > 10);
              if (isDisruptive) {
                return {
                  id: `weather-${loc.name}-${Date.now()}`,
                  title: `Weather Alert: ${condition} in ${loc.name}`,
                  type: "Weather",
                  severity: ["Tornado", "Thunderstorm", "Squall"].includes(condition) ? "High" : "Medium",
                  location: loc.name,
                  timestamp: new Date().toISOString(),
                  summary: `Severe weather (${data.weather[0].description}) detected. Potential logistics impact.`,
                  impactedSuppliers: loc.supplierIds || [],
                  weatherIcon: data.weather[0].icon
                };
              }
            }
          } catch (e) { return null; }
          return null;
        })
      );
      res.json(alerts.filter(Boolean));
    } catch (error) {
      console.error("Weather API error:", error);
      res.status(500).json({ error: "Failed to fetch weather" });
    }
  });

  // ── Current weather ────────────────────────────────────────────────────────
  app.get("/api/weather/current", async (req, res) => {
    const { lat, lon } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Weather API key not configured" });
    if (!lat || !lon) return res.status(400).json({ error: "lat and lon required" });
    try {
      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
      if (!response.ok) throw new Error("OpenWeatherMap error");
      res.json(await response.json());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch current weather" });
    }
  });

  // ── Groq: supplier intelligence ────────────────────────────────────────────
  app.post("/api/gemini/supplier-intelligence", async (req, res) => {
    const { supplier, weatherData, isSimulated, relevantDisruptions } = req.body;
    try {
      const result = await withTimeout(
        generateSupplierIntelligence(supplier, weatherData, isSimulated, relevantDisruptions),
        45000,
        {
          supplierId: supplier?.id || "",
          summary: "Service timed out. Displaying baseline telemetry.",
          vectorSummary: "Service timed out.",
          weatherStatus: "Pending.",
          suggestedStatus: supplier?.status || "STABLE",
          todayFeed: [], recentFeed: [],
          historicalContext: "Standard monitoring active.",
          recommendations: ["Check communications"],
          mitigationSteps: ["Check communications"],
          confidenceScore: 5,
          alternativeSuppliers: [],
          lastUpdated: new Date().toISOString(),
          sources: [],
          impactAnalysis: { bottleneck: "Communication Link", estDelay: "0h", strategicAction: "Check Network" }
        }
      );
      res.json(result);
    } catch (error: any) {
      console.error("supplier-intelligence error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Groq: impact analysis ──────────────────────────────────────────────────
  app.post("/api/gemini/impact-analysis", async (req, res) => {
    try {
      const { supplier, isSimulated } = req.body;
      const { generateImpactAnalysis } = await import("./services/geminiService");
      const result = await withTimeout(
        generateImpactAnalysis(supplier, isSimulated),
        25000,
        { estDelay: "Unknown", bottleneck: "Unknown", strategicAction: "Assess situation" }
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Groq: global risk signals ──────────────────────────────────────────────
  app.post("/api/gemini/global-risk-signals", async (req, res) => {
    const { user, suppliers } = req.body;
    try {
      const result = await withTimeout(generateGlobalRiskSignals(user, suppliers), 45000, []);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Groq: resource briefing ────────────────────────────────────────────────
  app.post("/api/gemini/resource-briefing", async (req, res) => {
    const { title, location, type, activeDisruptionSummary } = req.body;
    try {
      const result = await withTimeout(
        generateResourceBriefing(title, location, type, activeDisruptionSummary),
        45000,
        { summary: activeDisruptionSummary || `Summary for ${title}.`, keyPoints: ["Intelligence pending"], status: "Pending" }
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Groq: resource document ────────────────────────────────────────────────
  app.post("/api/gemini/resource-document", async (req, res) => {
    const { title, location, type, activeDisruptionSummary } = req.body;
    try {
      const result = await withTimeout(
        generateResourceDocument(title, location, type, activeDisruptionSummary),
        45000,
        {
          title: title || "",
          summary: activeDisruptionSummary || `Handbook for ${title}.`,
          keyPoints: ["Sync limit reached."],
          executiveSummary: "System response manual compiled offline.",
          detailedAnalysis: "Baseline analytics offline.",
          riskAssessment: activeDisruptionSummary || "No disruptions found.",
          operationalProtocol: "Standard operating guidelines active.",
          mitigationStrategies: "Consult offline playbook.",
          classification: "INTERNAL // OFFLINE"
        }
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Groq: news ─────────────────────────────────────────────────────────────
  app.post("/api/gemini/news", async (req, res) => {
    const { category } = req.body;
    try {
      const result = await withTimeout(fetchRealTimeNews(category), 45000, [
        {
          title: "Global Supply Chain Monitoring Active",
          summary: "Systems maintaining real-time logistics monitoring.",
          url: "https://www.reuters.com",
          source: "Reuters",
          timestamp: "Just now"
        }
      ]);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Static frontend (only used when running monolithically, NOT in split deploy) ──
  if (process.env.SERVE_STATIC === "true") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  await app.listen(Number(PORT), "0.0.0.0");
  console.log(`VISOR backend running on port ${PORT}`);
}

startServer().catch(console.error);
