# 🛰️ VISOR - AI-Native Supply Chain Resilience Copilot

VISOR is an AI-powered supply chain resilience platform for monitoring disruption risks, simulating critical scenarios, and supporting proactive mitigation decisions using live signals and Gemini-powered reasoning.


---

## Overview

VISOR helps move supply chain operations from reactive monitoring toward predictive resilience by combining:

- Real-time disruption signals
- AI-driven risk analysis
- Node-level crisis simulation
- Mitigation recommendations
- Supply network visibility

The system monitors potential disruptions such as weather events, port congestion, strikes, and operational anomalies, then generates contextual intelligence to support decision-making.

---

## Features

### Predictive Risk Intelligence

- Dynamic disruption risk detection
- Severity classification
- Context-aware AI risk analysis

### Real-Time Signal Monitoring

- Weather monitoring via OpenWeather
- Port congestion and event signals
- Historical risk context

### Node Briefings

- Live risk intelligence per supply node
- Stability assessments
- Alternate node recommendations
- Mitigation planning

### Crisis Simulation Mode

- Node-level what-if disruption scenarios
- Cascading impact analysis
- Stress testing under critical conditions

### Dashboard & Visualization

- Executive intelligence dashboard
- Supply node map visualization
- Risk signals and operational alerts

---

## Architecture

VISOR consists of:

- **Frontend Interface**
    
    Dashboard, node briefings, crisis simulation, Map visualization, Resources and Authentication views
    
- **Signal Layer**
    
    Weather feeds, disruption signals, historical archives
    
- **Intelligence Layer**
    
    Gemini-powered reasoning and risk analysis
    
- **Decision Layer**
    
    Severity classification, mitigation recommendations, crisis simulation
    
- **Deployment Layer**
    
    Google Cloud Run
    

---

## Tech Stack

### AI / Intelligence

- Google Gemini API
- Prompt-driven reasoning

### APIs

- OpenWeather API
- Google Maps API
- Groq API
- News API

## Getting Started

### Prerequisites

- Node.js

Install dependencies

```bash
npm install
```

Configure environment variables in `.env.local`

```
GROQ_API_KEY=
OPENWEATHER_API_KEY=
GOOGLE_MAPS_API_KEY=
NEWS_API_KEY=
```

Run locally

```bash
npm run dev
```

---

## Deployment

Deploy using Google Cloud Run.

---

# 🧠 How It Works

```
Authentication
   ↓
Supply Node Monitoring
   ↓
Real-Time Signals
(Weather + Events + Archives)
   ↓
Gemini Risk Reasoning
   ↓
Severity Classification
   ↓
Mitigation Recommendations
   ↓
Decision Support Dashboard
   ↓
(Optional)
Node Crisis Simulation
```

---

## Future Enhancements

- Sector-specific adaptive dashboards
- Mitigation optimization
- Supplier dependency graph modeling
- Adaptive resilience scoring
- Inventory impact estimation
- Automated alert escalation workflows

---

## Vision

Build intelligent tools that help supply chains become more resilient, adaptive and proactive under disruption.
----

