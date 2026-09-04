# SentinelBurn AI
> **SIH26170 · Indian Space Research Organisation (ISRO) · Theme: Smart Automation**  
> AI-Driven Anomaly Detection in Component Burn-In & Screening

---

## 🛸 Overview
**SentinelBurn AI** is an aerospace-grade AI operations and decision-support platform designed for electronic component qualification. It monitors hundreds of Devices Under Test (DUTs) during extended thermal-electrical burn-in screening, performs real-time multi-model anomaly detection, provides explainability (SHAP feature attribution), enforces an immutable cryptographic SHA-256 hash-chained audit trail, and generates official Lot Disposition PDF Reports.

---

## 🏛️ System Architecture

```text
sentinelburn-ai/
├── client/              # React 18 + Vite + Tailwind + Zustand + Recharts Mission Control Console
├── server/              # Node.js + Express + TypeScript + Socket.IO + Audit Trail + PDF Engine
├── ml-service/          # Python FastAPI microservice (Isolation Forest + STL Drift + Sequence Autoencoder + SHAP)
├── simulator/           # Parametric Telemetry Simulator (200 DUTs, 5 Injected Anomaly Classes)
└── docker-compose.yml   # Multi-container deployment specification
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)

### Setup and Launch
```bash
# 1. Install root dependencies
npm install

# 2. Start all services concurrently (or run individual components)
npm run dev
```

### Direct Service Ports
- **Frontend Console**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000`
- **ML Microservice**: `http://localhost:8000`
- **Simulator Service**: `http://localhost:8001` or managed directly via backend run orchestration
