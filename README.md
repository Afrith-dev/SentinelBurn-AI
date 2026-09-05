# 🛰️ SentinelBurn AI

> **SIH26170 · ISRO Smart India Hackathon 2026 · Theme: Smart Automation**  
> AI-Driven Anomaly Detection Platform for Electronic Component Burn-In & Screening

---

## 1. Project Name

**SentinelBurn AI** — Space-grade AI-powered anomaly detection for electronic component burn-in and environmental screening, designed for ISRO qualification workflows.

---

## 2. Problem Statement

Electronic components used in space and aerospace applications must undergo rigorous burn-in testing to screen out early-life failures (infant mortality). Traditional manual monitoring of hundreds of Devices Under Test (DUTs) across multi-day burn-in sessions is:

- **Error-prone** — human operators miss subtle parametric drift patterns
- **Slow** — post-hoc analysis happens after damage is done
- **Non-traceable** — paper-based logs fail DO-178C and ECSS audit requirements

**SentinelBurn AI** solves this by continuously monitoring real-time telemetry (voltage, current, leakage current, temperature) from up to 200 DUTs simultaneously, using a 3-model AI ensemble to detect anomalies in milliseconds with explainable SHAP attribution and full cryptographic audit trails.

---

## 3. Features

### Core Features
- 🔴 **Real-time Telemetry Ingestion** — 200-DUT live data stream via Socket.IO WebSocket bus
- 🤖 **3-Model AI Ensemble** — IsolationForest (point anomaly) + Mann-Kendall STL (drift) + Sequence Autoencoder (temporal patterns)
- 📊 **Anomaly Confidence Score** — Calibrated 0–100 score with severity tiers: Nominal / Info / Warning / Critical
- 🔍 **SHAP Explainability** — Feature attribution waterfall chart explaining *why* each device was flagged
- 🗺️ **200-DUT Heatmap** — Live color-coded matrix of all devices under test
- 🚨 **Real-time Alerts** — Instant WebSocket-pushed alerts with anomaly class guess
- 👤 **Engineer Disposition** — Accept / Reject / Hold-FA decision workflow per device
- 📋 **PDF Report Generation** — Qualification screening report with all flagged devices
- 🔐 **SHA-256 Audit Chain** — Tamper-evident cryptographic audit trail for every state change
- 🎙️ **Voice Copilot** — Natural language query interface for mission console

### Bonus Features
- 5 Anomaly Classes: Sudden Shift, Gradual Drift, Intermittent Spike, Cohort Outlier, Thermal Lag
- Live Anomaly Injection (for demo and stress testing)
- Model Performance Dashboard with confusion matrix and per-class recall
- 5 Role-Based Access: Admin, QA Manager, Reliability Engineer, Operator, FA Engineer
- Speed-multiplier simulation (1x–120x real-time acceleration)

---

## 4. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Recharts, Zustand |
| **Backend API** | Node.js, Express, TypeScript, Socket.IO, JWT Auth |
| **ML Microservice** | Python 3.11, FastAPI, Uvicorn, scikit-learn, NumPy, SciPy |
| **Telemetry Simulator** | Python 3.11, FastAPI, threading |
| **AI/ML Models** | IsolationForest, Mann-Kendall Trend Test, Sequence Autoencoder |
| **Explainability** | SHAP (SHapley Additive exPlanations) |
| **Real-time** | Socket.IO WebSocket, REST API |
| **Deployment** | Vercel (Frontend), Render (Backend + ML), GitHub |
| **Auth** | JWT Bearer Token, bcrypt password hashing |

---

## 5. Screenshots

### Landing Page
![Landing Page](./docs/screenshots/landing.png)

### Mission Console Dashboard
![Dashboard](./docs/screenshots/dashboard.png)

### Live Run Monitor — 200-DUT Heatmap
![Run Monitor](./docs/screenshots/run_monitor.png)

### SHAP Anomaly Explanation
![SHAP Explanation](./docs/screenshots/shap_explain.png)

### Model Performance Metrics
![Model Performance](./docs/screenshots/model_performance.png)

---

## 6. Live Demo

🌐 **Frontend:** https://sentinel-burn-ai.vercel.app  

### Demo Login Credentials
The app auto-logs in as Reliability Engineer for demo. Alternatively:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sentinelburn.aero | password123 |
| Reliability Engineer | engineer@sentinelburn.aero | password123 |
| QA Manager | qa@sentinelburn.aero | password123 |
| Operator | operator@sentinelburn.aero | password123 |
| FA Engineer | fa@sentinelburn.aero | password123 |

---

## 7. Backend

🔧 **Backend API:** https://sentinelburn-backend.onrender.com  
🤖 **ML Core Service:** https://sentinelburn-ml.onrender.com  

> ⚠️ Render free tier services spin down after 15 min of inactivity. First request may take 30–60 seconds to wake up.

### API Health Endpoints
```
GET /api/health         → Backend status
GET /ml/health          → ML ensemble status
GET /simulator/status   → Simulator status
```

---

## 8. Setup Instructions (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.11+
- npm

### 1. Clone the repository
```bash
git clone https://github.com/Afrith-dev/SentinelBurn-AI.git
cd SentinelBurn-AI
```

### 2. Install dependencies
```bash
# Install all Node.js dependencies (root + server + client)
npm run install:all

# Install Python dependencies (ML service)
cd ml-service && pip install -r requirements.txt && cd ..

# Install Python dependencies (Simulator)
cd simulator && pip install -r requirements.txt && cd ..
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env if needed — defaults work for local development
```

### 4. Run all services
```bash
# Option A: Run everything together (requires concurrently)
npm run dev

# Option B: Run each in a separate terminal
# Terminal 1 — Backend API
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev

# Terminal 3 — ML Microservice
cd ml-service && python app.py

# Terminal 4 — Telemetry Simulator
cd simulator && python telemetry_generator.py
```

### 5. Open the app
```
Frontend:  http://localhost:5173
Backend:   http://localhost:4000/api/health
ML Core:   http://localhost:8000/ml/health
Simulator: http://localhost:8001/simulator/status
```

### Quick Demo Walkthrough
1. Open http://localhost:5173 → Landing page
2. Click **"Enter Mission Console"** → Login (auto demo login)
3. Click **"Create Burn-In Run"** → Fill lot details → Submit
4. Click **▶ Start** on the Run Monitor → Watch 200-DUT heatmap animate
5. Anomaly alerts appear in the right panel (SHAP explanation included)
6. Click any flagged device → Device Deep Dive → Disposition decision
7. Go to **Reports** → Generate qualification PDF

---

## 9. Environment Variables

> ⚠️ Never commit `.env` to GitHub. Use `.env.example` as a template.

### Backend (`server/`)
| Variable | Description |
|----------|-------------|
| `PORT` | HTTP server port (default: 4000) |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) |
| `CLIENT_URL` | Frontend URL for CORS (Vercel URL in production) |
| `ML_SERVICE_URL` | URL of the ML microservice (Render URL in production) |
| `SIMULATOR_URL` | URL of the telemetry simulator |

### Frontend (`client/`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (Render URL in production) |

Set these in:
- **Vercel Dashboard** → Project Settings → Environment Variables (for `VITE_API_URL`)
- **Render Dashboard** → Service → Environment (for backend vars)

## 10. Deployment (Production)

This repository is preconfigured for deploying the frontend to Vercel and the backend + ML microservice to Render. Below are precise steps you can copy/paste.

1) Prepare environment

```bash
# Copy template and edit values
cp .env.example .env
# Edit .env or set env vars directly in Vercel/Render dashboards
```

2) Deploy backend + ML on Render

The included `render.yaml` (repo root) defines two services:
- `sentinelburn-backend` (Node.js, folder: `server`)
- `sentinelburn-ml` (Python FastAPI, folder: `ml-service`)

Use Render dashboard: Import repo → choose `render.yaml` → set env vars (required: `JWT_SECRET`, `CLIENT_URL`, `ML_SERVICE_URL`, etc.) → Deploy.

Optional: Render CLI (requires authentication)
```bash
# Install render CLI
npm i -g @render/cli
render login
render services create --file render.yaml
```

3) Deploy frontend to Vercel

Via Vercel dashboard: Import repository → ensure `vercel.json` is used → set Environment Variables: `VITE_API_URL` and `VITE_SOCKET_URL` to your Render backend URL → Deploy.

Via Vercel CLI:
```bash
npm i -g vercel
vercel login
cd /path/to/repo
vercel --prod
# Add production env vars
vercel env add VITE_API_URL production <https://your-render-backend>
vercel env add VITE_SOCKET_URL production <https://your-render-backend>
vercel --prod
```

4) Post-deploy verification

- Frontend: https://<your-vercel-domain>
- Backend health: https://<render-backend>/api/health
- ML health: https://<render-ml>/ml/health

Walkthrough: Visit frontend → Login with demo credentials → Create Run → Start Run → Observe telemetry and alerts on the heatmap.

If anything fails, check Vercel build logs and Render service logs for errors.

---

## Architecture

```
                        ┌─────────────────────────────────┐
                        │        GitHub Repository         │
                        └───────────────┬─────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              │                         │                          │
              ▼                         ▼                          ▼
     ┌────────────────┐      ┌─────────────────────┐    ┌──────────────────┐
     │  Vercel (CDN)  │      │  Render — Node.js   │    │  Render — Python │
     │                │      │  Backend API +       │    │  ML Microservice │
     │  React + Vite  │◄────►│  Socket.IO           │◄──►│  FastAPI         │
     │  TailwindCSS   │ WSS  │  JWT Auth            │    │  IsolationForest │
     │  Zustand       │ REST │  Audit Chain         │    │  Mann-Kendall    │
     └────────────────┘      └─────────────────────┘    │  SHAP Explainer  │
                                                         └──────────────────┘
```

---

## License

MIT License — Built for SIH26170 | ISRO Smart India Hackathon 2026
