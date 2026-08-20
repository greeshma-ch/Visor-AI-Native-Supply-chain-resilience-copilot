# VISOR — AI-Native Supply Chain Resilience Copilot
**Demo Version | Active Development**

VISOR is an AI-powered supply chain resilience copilot that monitors supplier networks, combines live news and weather signals with deterministic risk scoring, and generates AI-powered intelligence briefings for operational decision-making.

**Live Demo:** https://visor-ai-native.vercel.app

---

## What VISOR Does

VISOR turns fragmented supply-chain signals into a single supplier-level risk view.

```text
News + Weather
      ↓
Supply Chain Impact Analysis
      ↓
Deterministic Risk Engine
      ↓
AI Executive Briefing
      ↓
Actionable Supplier Intelligence
```
It helps answer:

Which suppliers are at risk?
Why are they at risk?
What could be impacted?
How severe is the risk?
What should be done next?
Architecture

VISOR uses a multi-agent pipeline with a deterministic risk layer:

             ┌──────────────┐
             │  News Agent  │
             └──────┬───────┘
                    │
                    ├──────────────┐
                    │              │
             ┌──────▼──────┐ ┌─────▼───────┐
             │Supply Chain │ │Weather Agent│
             │    Agent    │ └─────┬───────┘
             └──────┬──────┘       │
                    └───────┬──────┘
                            ▼
                  ┌──────────────────┐
                  │    Risk Agent    │
                  │  Deterministic   │
                  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐
                  │ Briefing Agent   │
                  │   Groq / LLM     │
                  └────────┬─────────┘
                           ▼
                  Supplier Intelligence

                  
Key architectural principle

The LLM explains risk; it does not decide risk.

The Risk Agent produces the authoritative risk score from structured evidence. The Briefing Agent then uses that score and the collected evidence to generate the executive narrative.

Risk Scoring

VISOR uses a deterministic 0–100 risk score:

Score Status
1. 0–39    🟢 STABLE 
2. 40–69   🟡 CAUTION 
3. 70–100  🔴 RISKY   

The score considers:

Event severity
Supplier criticality
Geographic proximity
Data confidence
Event duration

This makes the core risk classification transparent and reproducible rather than dependent on LLM output.

---

## Core Features

🌐 Global Risk Intelligence

Aggregates live news and weather signals across the supplier network.

🧠 Supplier Intelligence

Generates supplier-specific risk assessments and executive briefings.

📊 Deterministic Risk Engine

Produces explainable risk scores independently of the LLM.

🗺️ Geospatial Intelligence

Maps suppliers and connects geographic proximity to potential disruptions.

🚨 Crisis Simulation

Allows controlled disruption scenarios to test how supplier risk propagates through the system.

🏭 Supplier Registry

Manage supplier nodes and monitor their current operational risk.

🔎 Evidence-Driven Briefings

Combines news, weather, supply-chain impact, historical context and mitigation recommendations into a single briefing.

---

## Tech Stack

Frontend

React
TypeScript
Vite
Tailwind CSS
Recharts
Google Maps

Backend

Node.js
Express
TypeScript

AI

Groq
Multi-agent orchestration
Deterministic risk engine

External Intelligence

NewsAPI
OpenWeather
Google Maps API

Database & Authentication

Supabase

---

## Deployment

Vercel — Frontend
Render — Backend
Project Structure
VISOR/
├── agents/
│   ├── coordinator.ts
│   ├── newsAgent.ts
│   ├── weatherAgent.ts
│   ├── supplyChainAgent.ts
│   ├── riskAgent.ts
│   └── briefingAgent.ts
│
├── components/
├── views/
├── services/
├── lib/
├── supabase/
│
├── App.tsx
├── server.ts
├── types.ts
└── package.json

---

## Local Development
Install
npm install
Backend environment

Create .env:

GROQ_API_KEY=your_groq_api_key
NEWS_API_KEY=your_news_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
Frontend environment
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
Run backend
npm run dev
Run frontend
npx vite

---

## Demo Deployment

Frontend:
https://visor-ai-native.vercel.app

The frontend is deployed on Vercel and communicates with the Node.js/Express intelligence backend deployed separately on Render.

**Demo Status**

This is a deployed demonstration build, not yet a production-hardened system.

The core intelligence pipeline is implemented and functional. The project is currently undergoing final architectural stabilization before being considered production-ready.

Current architectural work
1.Risk-state consistency between global analysis and supplier briefings
2.Authoritative risk snapshot propagation
3.Crisis simulation precedence
4.New supplier PENDING lifecycle
5.Background supplier intelligence updates
6.Supplier alternative-node resolution
7.Frontend/backend state consistency
8.Production error and timeout handling

These are hardening and consistency fixes, not changes to the fundamental architecture.

---

## Design Philosophy

VISOR separates three responsibilities:

External Systems
      ↓
Evidence Collection
      ↓
Deterministic Risk
      ↓
AI Explanation

This prevents the LLM from becoming the source of truth for operational risk while still using generative AI where it adds the most value: reasoning, synthesis and communication.

---

## Why VISOR?

Traditional supply-chain dashboards often show data without explaining what it means operationally.

VISOR aims to bridge that gap:

Detect → Analyze → Score → Explain → Act

The objective is to turn continuously changing external signals into supplier-level intelligence that an operations team can understand and act on quickly.

---

## Development Status

Current: 🟡 Demo / Active Architectural Stabilization

The application is deployed and available for demonstration.

The next engineering phase focuses on production hardening, reliability, state consistency and performance optimization.

---

## License

This project is maintained as a personal/project demonstration repository.
