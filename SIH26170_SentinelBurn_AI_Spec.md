# Spec Driven Development
## Building "SentinelBurn AI" — AI-Driven Anomaly Detection in Component Burn-In & Screening
### SIH26170 · Indian Space Research Organisation (ISRO) · Theme: Smart Automation

---

## Table of Contents

1. Introduction
   1.1 What Spec Driven Development Means
   1.2 Why SDD Matters for a Hackathon Build
2. Problem Statement Analysis (SIH26170)
   2.1 Official Problem Context
   2.2 Domain Primer — What Burn-In & Screening Actually Is
   2.3 The Core Gap We Are Closing
3. What We Are Going to Build
   3.1 Product Vision
   3.2 Target Personas
   3.3 Solution Narrative (End-to-End Story)
4. The Parameters of a Good Specification
5. Complete Specification
   5.1 Project Overview & Tech Stack
   5.2 Data Layer — Acquisition, Simulation & Datasets
   5.3 AI/ML Architecture — The Anomaly Detection Core
   5.4 Authentication, Roles & Workflow Orchestration
   5.5 Real-Time Streaming & Alerting Layer
   5.6 Frontend Pages
   5.7 Backend Architecture & Database Collections
   5.8 API Endpoints
   5.9 Folder Structure
   5.10 Development Phases (Hackathon Timeline)
   5.11 UI/UX Requirements
   5.12 Security, Compliance & Data Integrity
   5.13 Final Expected Outcome
6. Complete Feature List
7. Where Each Specification Parameter Shows Up
8. Hackathon Execution Playbook
   8.1 Team Roles
   8.2 36-Hour Build Timeline
   8.3 Judging Criteria Alignment (SIH Rubric)
   8.4 Novelty & Differentiators
   8.5 Feasibility & Cost Justification
   8.6 Risk Register & Fallback Plans
9. Pitch Deck & Demo Script Structure
10. Codex / AI Coding Agent Implementation Instructions
11. Why a Single Spec Is Not Enough
12. Closing Thought

---

## 1. Introduction

### 1.1 What Spec Driven Development Means

Spec Driven Development (SDD) is a development approach where the specification is written **before** any code, model, or slide is produced. The core principle is simple: **Specification first, build second, pitch third.**

In a 36-hour hackathon sprint, teams that start typing code in the first hour almost always end up with a demo that does not match the judging rubric, a frontend that does not match the backend's data contracts, and a pitch deck that contradicts what was actually built. SDD forces the team to pause, write down what the product does, who it is for, what the AI model actually detects, what the database looks like, what the API contract is, and how the 4-minute demo will be structured — **before** a single line of code exists.

For SIH26170, where the deliverable spans an ML anomaly-detection pipeline, a real-time dashboard, a simulated hardware/sensor layer, and a compliance-grade audit trail, the specification is the only artifact that keeps five team members (frontend, backend, ML, hardware/simulation, and presentation) building toward the same finish line.

### 1.2 Why SDD Matters for a Hackathon Build

A vague prompt produces a vague hackathon submission. If a team tells an AI coding agent (or each other) "build an anomaly detection system for electronic components," everyone guesses differently: one member builds a fraud-detection-style dashboard, another wires up a generic CSV upload tool, a third trains a model on the wrong kind of data (images instead of time-series telemetry). The result is a demo that looks impressive in isolation but does not tell one coherent story on stage.

A clear specification eliminates this. It locks the tech stack, locks the exact anomaly types being detected, locks the database schema, locks the five demo screens, and locks the exact sentence the presenter says when explaining the AI model to the judges. This document is that contract for **SentinelBurn AI**.

---

## 2. Problem Statement Analysis (SIH26170)

### 2.1 Official Problem Context

| Field | Value |
|---|---|
| Problem Statement ID | SIH26170 |
| Organization | Indian Space Research Organisation (ISRO) |
| Theme | Smart Automation |
| Title | AI-Driven Anomaly Detection in Component Burn-In & Screening |
| Category | Software / Hardware-assisted Software |

Component burn-in and screening is a mandatory qualification step in space-grade electronics manufacturing. Before a resistor, capacitor, transistor, IC, or power module is allowed anywhere near a satellite, launch vehicle, or payload, it must survive an extended electrical and thermal stress regime designed to force early-life ("infant mortality") failures to happen on the test bench instead of in orbit. Today, this process at ISRO and its component-screening centres generates enormous volumes of parametric telemetry — voltage, current, leakage current, temperature, and drift readings sampled continuously over hours or days per batch — which is still substantially reviewed through threshold-based pass/fail checks and manual engineer inspection of trend charts. This is slow, inconsistent across shifts/engineers, and prone to missing **subtle, gradual drift patterns** that precede a failure but never cross a hard threshold before the burn-in window ends.

### 2.2 Domain Primer — What Burn-In & Screening Actually Is

For any team member who has not worked in reliability engineering before, the workflow this project digitizes is as follows:

1. **Incoming Lot** — A batch (lot) of electronic components (diodes, transistors, ICs, hybrid microcircuits, power devices) arrives for space-grade qualification.
2. **Screening Tests** — Components undergo a sequence of stress screens: visual/X-ray inspection, PIND (Particle Impact Noise Detection), temperature cycling, constant acceleration (centrifuge), hermeticity, and electrical parameter tests at each stage.
3. **Burn-In** — Surviving components are loaded onto burn-in boards inside thermal chambers and operated continuously at elevated temperature (typically 125°C or per MIL-STD/ISRO PEM/PID specs) and rated voltage for an extended duration (commonly 48–168 hours). Sensors continuously log voltage, current, leakage current (I_R), forward/reverse characteristics, and chamber temperature per device-under-test (DUT), per channel.
4. **Post Burn-In Electrical Test (PBEIT)** — Every DUT is re-measured against its pre-burn-in baseline. Parametric shift (delta) beyond a specified percentage is grounds for rejection.
5. **Disposition** — Engineers classify each DUT as **Accept**, **Reject**, or **Hold for Failure Analysis (FA)**, and the entire lot's data is archived for traceability (a satellite component must be traceable for its operational lifetime, often 15+ years).

The failure signatures that matter most are not simple threshold breaches (those are already caught by existing pass/fail logic) — they are **anomalous time-series behaviour**: a device whose leakage current creeps upward in a non-linear way, a device whose temperature response lags or overshoots relative to its cohort, a device exhibiting micro-oscillations or noise-floor changes, or a device that is a statistical outlier relative to the rest of its lot even though every individual sample is inside spec. These are exactly the patterns an AI/ML anomaly-detection layer is suited to catch, and exactly the patterns a purely rule-based screening system misses.

### 2.3 The Core Gap We Are Closing

| Current State | Gap | SentinelBurn AI Response |
|---|---|---|
| Manual review of trend charts by engineers | Slow, subjective, shift-dependent | Automated, always-on anomaly scoring |
| Static pass/fail thresholds per parameter | Misses gradual drift and cohort outliers | Multivariate + time-series ML models |
| Disconnected spreadsheets / chamber logs | No unified traceability or audit trail | Centralized DB with immutable execution logs |
| Failure classified only after full burn-in ends | Early failures found late, wasting chamber time | Early-warning scoring during the run, not just at the end |
| No explainability for why a device failed | Failure analysis (FA) engineers restart from zero | SHAP-based explainability per anomaly flag |
| No lot-to-lot learning | Institutional knowledge stays with individual engineers | Model retrains on confirmed FA outcomes, improving over time |

---

## 3. What We Are Going to Build

### 3.1 Product Vision

**SentinelBurn AI** is an AI-powered anomaly detection and decision-support platform for electronic component burn-in and screening. It ingests real-time (or replayed/simulated) parametric telemetry from burn-in chambers, applies a multi-model anomaly detection pipeline (statistical baselining, multivariate outlier detection, and sequence-based deep learning) to every device-under-test, and surfaces ranked, explainable anomaly alerts to quality engineers through a live operations dashboard — years before a defect would otherwise surface as an on-orbit failure.

### 3.2 Target Personas

- **Reliability / Quality Engineer** — Monitors live burn-in runs, reviews anomaly alerts, disposes of components (Accept/Reject/FA).
- **Test Floor Operator** — Loads DUTs, starts/stops burn-in runs, attaches lot metadata, watches chamber health.
- **Failure Analysis (FA) Engineer** — Investigates flagged components using the explainability layer and historical trend replay.
- **Quality Assurance Manager / Admin** — Reviews lot-level statistics, approves final lot disposition, exports audit-ready reports, manages user roles.
- **Data Scientist (internal)** — Retrains and monitors the anomaly models as confirmed FA outcomes accumulate.

### 3.3 Solution Narrative (End-to-End Story)

A lot of 200 hybrid microcircuits enters burn-in. The operator creates a **Burn-In Run** in SentinelBurn AI, attaches lot metadata (part number, manufacturer, date code, spec reference), and starts the chamber. Sensor telemetry — voltage, current, leakage current, and chamber temperature per channel — streams into the platform every few seconds via a simulated MQTT/WebSocket feed (or a real DAQ bridge where hardware is available). The **Baseline Agent** establishes each device's expected operating envelope from its first hours of data and its cohort. The **Anomaly Scoring Agent** continuously runs an ensemble of an Isolation Forest (fast multivariate outlier detection), a Seasonal/Trend residual model (drift detection), and an LSTM Autoencoder (sequence reconstruction-error detection) across every channel, producing a live anomaly score (0–100) per DUT. When a score crosses a configurable threshold, the **Alert Agent** raises a flagged event, attaches a SHAP-based explanation ("Leakage current on Channel 14 deviated 3.2σ from cohort trend starting at hour 26"), and pushes a real-time notification to the dashboard and, optionally, email/SMS. The engineer reviews the flagged DUT's live and historical trend, compares it against its cohort, reads the explanation, and marks a disposition. At the end of the run, SentinelBurn AI auto-generates a **Lot Disposition Report** (PDF) with every accept/reject/FA decision, model scores, and a full immutable audit trail — ready for ISRO's quality documentation requirements.

---

## 4. The Parameters of a Good Specification

Not every document qualifies as a good spec. A specification that a team (and any AI coding agent assisting the team) can reliably build from must meet these quality bars:

- **Clarity** — Every sentence has one meaning; no vague words like "etc." or "handles anomalies somehow."
- **Completeness** — Problem framing, stack, ML pipeline, data model, routes, folder structure, and demo verification are all covered.
- **Consistency** — Field names used in the ingestion layer match the field names used in the ML pipeline, the database, and the dashboard.
- **Concrete Technology Choices** — The stack, libraries, and even the specific anomaly algorithms are named explicitly, not described in general terms ("some ML model").
- **Structured Sections** — Related information lives under clear headings that are easy to scan under time pressure.
- **Phased Delivery** — The build is broken into reviewable checkpoints instead of one 36-hour blind sprint.
- **Authoritative Tone** — "Must" and "shall," not "could maybe."
- **Demo-Readiness** — Every feature in the spec maps to something a judge can actually see and understand in a 4-minute window.

### Essential SDD Spec Topics Covered in This Document

Project Overview · Tech Stack · Core Features · Data Layer & Datasets · AI/ML Architecture · Authentication · Frontend Pages · Backend Architecture · Database Collections · API Endpoints · Folder Structure · Development Phases · UI/UX Requirements · Security Requirements · Final Expected Outcome · Hackathon Execution Playbook

---

## 5. Complete Specification

### 5.1 Project Overview & Tech Stack

**Project Overview**

Build a full-stack AI Operations platform called **SentinelBurn AI** that ingests component burn-in/screening telemetry, runs a multi-model anomaly detection pipeline per device-under-test, and gives quality engineers a real-time, explainable, audit-ready decision-support console. The platform must simulate (and be architected to later accept real) chamber telemetry, score every DUT continuously, explain every flagged anomaly, stream live updates to the browser, and persist a complete, tamper-evident audit trail for every burn-in run.

**Tech Stack**

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), TypeScript, Tailwind CSS, Recharts / D3.js (trend & telemetry charts), Zustand (state), Axios, Socket.IO client |
| Backend / API | Node.js, Express, TypeScript, JWT auth, express-validator, helmet, morgan, compression |
| Real-Time Layer | Socket.IO (WebSocket) for live telemetry + alert broadcast; MQTT broker (Mosquitto/EMQX) as the ingestion bus between simulated/real DAQ and backend |
| Database | PostgreSQL (relational — lots, runs, devices, dispositions, users) + TimescaleDB extension (time-series telemetry hypertable) |
| Cache / Queue | Redis + BullMQ for background scoring jobs, alert dispatch, and report generation |
| AI/ML Service | Python 3.11, FastAPI (microservice), scikit-learn (Isolation Forest, One-Class SVM), statsmodels (STL decomposition / trend residuals), PyTorch (LSTM Autoencoder), SHAP (explainability), pandas/numpy |
| Data Simulation | Python synthetic telemetry generator (normal + injected-anomaly device profiles) + optional Arduino/ESP32 + DHT22/INA219 bridge for a live hardware demo |
| Reporting | Puppeteer / WeasyPrint for PDF lot-disposition reports |
| DevOps | Docker Compose (all services), GitHub Actions (CI), deployed demo on Render/Railway/Vercel |

### 5.2 Data Layer — Acquisition, Simulation & Datasets

Because real ISRO burn-in chamber access is not available during a hackathon, the platform must be built around a **pluggable ingestion interface** so the exact same pipeline works with a synthetic simulator during the demo and a real DAQ/PLC bridge in production.

**Simulated Dataset Design**

- Generate telemetry for **N devices** (default 200) across **M channels** (voltage, current, leakage current I_R, case temperature) sampled every 5 simulated seconds over a compressed burn-in window (e.g., 168 real hours compressed into a 10–15 minute looped demo timeline, configurable speed multiplier).
- **95% of devices** follow a "healthy" profile: stable parametric values with realistic sensor noise and a small monotonic aging drift consistent with normal wear.
- **5% of devices** have **injected anomaly classes**, each independently labelled for evaluation:
  - **Sudden Shift** — an abrupt step-change in leakage current (simulates a latent defect suddenly manifesting).
  - **Gradual Drift** — slow, accelerating divergence from baseline (simulates thermal runaway precursor).
  - **Intermittent Spike / Noise Burst** — short bursts of high-variance noise (simulates a marginal solder joint or wire bond).
  - **Cohort Outlier** — a device whose values stay within absolute spec limits but are statistically distant from the rest of its lot (the case existing threshold-based systems completely miss).
  - **Thermal Lag** — abnormal temperature response time relative to chamber setpoint changes (simulates a packaging/heat-sink defect).
- Ground-truth anomaly labels and injection timestamps are stored alongside the synthetic data so the team can report precision/recall/F1 during the pitch — a **major differentiator** most hackathon teams skip.
- The generator is exposed as `POST /api/simulator/runs` so judges can trigger a fresh randomized run live on stage.

**Real Hardware Bridge (Optional Stretch Track)**

An ESP32 microcontroller with an INA219 current/voltage sensor and a DHT22 temperature sensor publishes live readings to the MQTT broker under the same topic schema as the simulator (`sentinelburn/telemetry/{runId}/{deviceId}`), proving the architecture is not a toy — it is the same code path that would face real chamber hardware.

### 5.3 AI/ML Architecture — The Anomaly Detection Core

The anomaly detection pipeline must be an **ensemble**, not a single model, because burn-in anomalies take multiple statistical shapes that no single algorithm catches well alone.

| Stage | Technique | What It Catches | Output |
|---|---|---|---|
| 1. Baselining | Rolling z-score + per-cohort mean/std (computed per lot, per channel, over first 10% of run) | Establishes "normal envelope" per device relative to its own cohort | Baseline profile per DUT |
| 2. Point Anomaly Detection | Isolation Forest (multivariate, all channels combined) | Sudden shifts, cohort outliers | Anomaly score 0–1 per sample |
| 3. Trend / Drift Detection | STL decomposition (seasonal-trend-residual) + Mann-Kendall trend test on residuals | Gradual drift, accelerating divergence | Drift score + trend direction |
| 4. Sequence Anomaly Detection | LSTM Autoencoder trained on healthy-device sequences; reconstruction error on live sequences | Intermittent spikes, thermal lag, complex temporal patterns a point-in-time model cannot see | Reconstruction-error score |
| 5. Ensemble Fusion | Weighted score fusion (configurable weights, default equal) + calibration against synthetic ground truth | Combines all signals into one 0–100 Anomaly Confidence Score | Final score + contributing model breakdown |
| 6. Explainability | SHAP values on the Isolation Forest / feature-level contribution report for the ensemble | Human-readable "why was this flagged" | Ranked list of contributing features/timestamps |

**Model Lifecycle**

- Models are trained offline on the synthetic healthy-device corpus before the event and shipped with the FastAPI service (`/mnt/models/*.pkl`, `*.pt`).
- A `POST /ml/retrain` endpoint (admin-only) allows retraining on newly confirmed FA outcomes, demonstrating the "learns over time" narrative live if needed.
- The FastAPI service exposes `POST /ml/score` (batch or streaming) consumed by the Node backend's BullMQ worker, keeping the ML runtime decoupled from the API layer.

**Why an Ensemble Beats a Single Model (talking point for judges)**

A single Isolation Forest alone misses slow drift because each individual sample still looks locally normal. A single LSTM Autoencoder alone is expensive to run on every sample and can be noisy on short warm-up windows. Combining a fast multivariate detector, a trend-test detector, and a sequence model gives high recall on all five injected anomaly classes while keeping false-positive rate low enough that engineers do not experience alert fatigue — directly addressing ISRO's stated pain point of "AI-driven" detection rather than more static thresholds.

### 5.4 Authentication, Roles & Workflow Orchestration

**Authentication**

The system must support registration/login (JWT, refresh tokens), a `/auth/me` profile endpoint, password hashing with bcrypt (cost 12), and persistent session state via Zustand on the client.

**Roles**

| Role | Capabilities |
|---|---|
| Admin | Full access, user management, model retraining, threshold configuration |
| QA Manager | Approve lot disposition, export reports, view all runs |
| Reliability Engineer | Monitor runs, review/acknowledge alerts, set device disposition |
| Operator | Create/start/stop runs, attach lot metadata, view live telemetry (no disposition rights) |
| FA Engineer | Full read access to flagged device history + explainability, cannot start/stop runs |

**Workflow Orchestration (Run Lifecycle)**

`CREATED → RUNNING → (live scoring + alerting) → COMPLETED → UNDER_REVIEW → DISPOSITIONED → ARCHIVED`, with `PAUSED` and `ABORTED` as exception states. Every state transition is written to an immutable `RunAuditLog`.

### 5.5 Real-Time Streaming & Alerting Layer

- MQTT broker receives telemetry from the simulator/hardware bridge on a per-run, per-device topic.
- A Node.js MQTT-to-WebSocket bridge service subscribes and republishes onto Socket.IO rooms scoped per `runId`, so only clients viewing that run receive its stream (efficient for multi-run demos).
- Telemetry is simultaneously written to the TimescaleDB hypertable (`telemetry_samples`) and pushed to a BullMQ queue for scoring.
- The scoring worker calls the FastAPI `/ml/score` endpoint in near-real-time (sub-second per batch) and emits `anomaly:flagged` Socket.IO events the moment a score crosses threshold.
- The dashboard renders a live-updating timeline (color-coded by agent/stage: baseline / point / drift / sequence / ensemble) exactly mirroring the explainability breakdown, and a **Notifications Drawer** persists every alert for later review.

### 5.6 Frontend Pages

- **/** — Landing page: platform introduction, problem statement framing, multi-model architecture showcase, CTA to login/demo.
- **/login, /register** — Auth forms with JWT handling, validation, error states.
- **/dashboard** — Operations console: active runs grid, lot-level KPIs (devices monitored, alerts raised today, mean time-to-flag), live anomaly feed, model health indicators.
- **/runs/new** — Create a burn-in run: lot metadata form (part number, manufacturer, date code, quantity, spec reference), simulator configuration (speed multiplier, anomaly-injection rate), start button.
- **/runs/[id]** — Live run monitor: per-device grid/heatmap (color = anomaly score), channel-level trend charts, live telemetry stream, chamber setpoint overlay, pause/resume/abort controls.
- **/runs/[id]/devices/[deviceId]** — Single-device deep dive: full historical trend, cohort comparison overlay, SHAP explanation panel, disposition action (Accept / Reject / Hold-for-FA) with engineer comment field.
- **/reports** — List of completed runs with generated PDF Lot Disposition Reports, filter/search/export.
- **/models** — Model performance page: precision/recall/F1 against synthetic ground truth, confusion matrix, per-anomaly-class breakdown, retrain trigger (admin).
- **/settings** — Profile, role management, alert-threshold configuration, theme.

### 5.7 Backend Architecture & Database Collections

**Backend Architecture**

- **Routes** — HTTP routing, request validation, middleware composition (auth, validation, error handler).
- **Controllers** — Request parsing/response shaping only.
- **Services** — Business logic (run lifecycle, disposition rules, report generation, alert dispatch).
- **ML Client Layer** — Thin client wrapping calls to the Python FastAPI scoring service; the Node backend never implements ML logic directly.
- **Ingestion Layer** — MQTT subscriber → TimescaleDB writer → BullMQ producer.
- **Queues Layer** — BullMQ wrapping Redis for scoring jobs, report generation, and alert dispatch.
- **Config Layer** — Centralizes env vars, DB connections (Postgres/TimescaleDB + Redis), Socket.IO and MQTT setup.

**Database Collections / Tables**

| Table | Key Fields |
|---|---|
| `users` | id, name, email, password_hash, role, last_login |
| `lots` | id, part_number, manufacturer, date_code, spec_reference, quantity, created_by |
| `runs` | id, lot_id, status, started_at, ended_at, speed_multiplier, anomaly_injection_config |
| `devices` | id, run_id, device_serial, channel_id, cohort_baseline_json |
| `telemetry_samples` (hypertable) | time, run_id, device_id, voltage, current, leakage_current, temperature |
| `anomaly_scores` | id, run_id, device_id, timestamp, point_score, drift_score, sequence_score, ensemble_score, contributing_features_json |
| `alerts` | id, run_id, device_id, score, severity, message, acknowledged_by, acknowledged_at |
| `dispositions` | id, device_id, decision (accept/reject/hold_fa), engineer_id, comment, decided_at |
| `run_audit_log` | id, run_id, event_type, actor_id, from_state, to_state, timestamp |
| `model_registry` | id, model_name, version, trained_at, precision, recall, f1, artifact_path |

### 5.8 API Endpoints

**Auth**
`POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`

**Lots & Runs**
`POST /api/lots` · `GET /api/lots` · `POST /api/runs` · `GET /api/runs` · `GET /api/runs/:id` · `POST /api/runs/:id/start` · `POST /api/runs/:id/pause` · `POST /api/runs/:id/abort` · `POST /api/runs/:id/complete`

**Telemetry & Scoring**
`GET /api/runs/:id/telemetry` (paginated/historical) · `GET /api/runs/:id/devices/:deviceId/telemetry` · `GET /api/runs/:id/devices/:deviceId/scores` · `GET /api/runs/:id/devices/:deviceId/explain`

**Alerts & Disposition**
`GET /api/runs/:id/alerts` · `POST /api/alerts/:id/acknowledge` · `POST /api/devices/:id/disposition`

**Reports & Models**
`GET /api/runs/:id/report` (generates/fetches PDF) · `GET /api/models` · `POST /api/models/retrain` (admin)

**Simulator**
`POST /api/simulator/runs` (spin up a fresh demo run) · `POST /api/simulator/runs/:id/inject-anomaly` (manually trigger a live anomaly for the judges)

**ML Microservice (internal, FastAPI)**
`POST /ml/score` · `POST /ml/explain` · `POST /ml/retrain` · `GET /ml/health`

### 5.9 Folder Structure

```
sentinelburn-ai/
├── client/
│   └── src/
│       ├── components/
│       │   ├── AppShell/
│       │   ├── TelemetryChart/
│       │   ├── DeviceHeatmap/
│       │   ├── AlertTimeline/
│       │   └── ExplainabilityPanel/
│       ├── pages/
│       │   ├── index.jsx / login.jsx / register.jsx / dashboard.jsx
│       │   ├── runs/ (new.jsx, [id].jsx, [id]/devices/[deviceId].jsx)
│       │   ├── reports.jsx / models.jsx / settings.jsx
│       ├── store/ (authStore.js, runStore.js)
│       └── services/ (api.js, socket.js)
├── server/
│   └── src/
│       ├── config/ (env.js, db.js, redis.js, mqtt.js, socket.js)
│       ├── routes/ · controllers/ · services/
│       ├── ingestion/ (mqttSubscriber.js, telemetryWriter.js)
│       ├── queues/ (scoringQueue.js, reportQueue.js, alertQueue.js)
│       ├── ml-client/ (scoreClient.js, explainClient.js)
│       └── models/ (Sequelize/Prisma schema definitions)
├── ml-service/
│   ├── app.py (FastAPI entrypoint)
│   ├── models/ (isolation_forest.py, drift_detector.py, lstm_autoencoder.py, ensemble.py)
│   ├── explain/ (shap_explainer.py)
│   ├── training/ (train_models.py, generate_synthetic_data.py)
│   └── artifacts/ (*.pkl, *.pt)
├── simulator/
│   └── telemetry_generator.py (healthy + 5 injected anomaly profiles)
├── hardware-bridge/ (optional: esp32_firmware/, mqtt_bridge.py)
└── docker-compose.yml
```

### 5.10 Development Phases (Hackathon Timeline)

- **Phase 1 (Setup)** — Repo scaffolding, Docker Compose (Postgres+Timescale, Redis, Mosquitto), auth, AppShell.
- **Phase 2 (Data Layer)** — Synthetic telemetry generator with 5 anomaly classes, MQTT publishing, ingestion into TimescaleDB, live Socket.IO passthrough.
- **Phase 3 (ML Core)** — Baseline agent, Isolation Forest, STL drift detector, LSTM Autoencoder, ensemble fusion, SHAP explainability, FastAPI service.
- **Phase 4 (Dashboard)** — Run monitor, device heatmap, live trend charts, alert timeline, notifications drawer.
- **Phase 5 (Disposition & Reporting)** — Device deep-dive page, disposition workflow, PDF Lot Disposition Report generation.
- **Phase 6 (Polish & Demo Hardening)** — Model performance page (precision/recall vs ground truth), manual anomaly-injection button for live demo, deployment, pitch rehearsal.

### 5.11 UI/UX Requirements

Clean operator-console aesthetic (dark-mode default, aerospace-inspired palette), fully responsive, skeleton loaders on all data fetches, color-coded severity badges (info/warning/critical), animated live-updating charts, a device heatmap that visually pulses on new anomalies, and a persistent notifications drawer accessible from the AppShell.

### 5.12 Security, Compliance & Data Integrity

Passwords hashed with bcrypt (cost 12); JWT signed/verified with `JWT_SECRET`; helmet security headers; CORS restricted to `CLIENT_URL`; rate-limiting on auth endpoints; every request body validated via express-validator; the `run_audit_log` table is **append-only** (no update/delete permissions at the DB role level) to preserve the traceability expected in aerospace-grade quality documentation; all disposition decisions are cryptographically hash-chained (each row includes a hash of the previous row) so any tampering with historical records is detectable — directly speaking to ISRO's traceability and audit requirements for flight-hardware components.

### 5.13 Final Expected Outcome

The completed platform must let a reliability engineer start a burn-in run, watch live telemetry stream in, see the AI ensemble continuously score every device, receive explainable real-time alerts for all five anomaly classes well before a static threshold would ever fire, review and disposition flagged devices with full historical and cohort context, and export an audit-ready Lot Disposition Report — with measurable precision/recall against a labelled synthetic dataset proving the model actually works, not just that it runs.

---

## 6. Complete Feature List

### ⭐ Must-Have / Core Features

- User authentication with role-based access (Admin, QA Manager, Reliability Engineer, Operator, FA Engineer)
- Lot & run creation with metadata capture
- Synthetic telemetry simulator with 5 labelled anomaly classes
- Real-time telemetry ingestion (MQTT → TimescaleDB → Socket.IO)
- Multi-model anomaly detection ensemble (Isolation Forest + drift detection + LSTM Autoencoder)
- Live per-device Anomaly Confidence Score (0–100)
- Real-time alert generation and live dashboard notification
- SHAP-based explainability per flagged anomaly
- Device deep-dive page with historical trend + cohort comparison
- Disposition workflow (Accept / Reject / Hold-for-FA) with audit logging
- Immutable, hash-chained audit trail
- Lot Disposition PDF report generation
- Model performance page with precision/recall/F1 against ground truth
- Search/filter across runs, devices, and alerts
- Working deployed application with a live, judge-triggerable demo run

### 🚀 Bonus / Advanced Features

- Real ESP32 + INA219/DHT22 hardware bridge publishing to the same MQTT schema
- Manual "inject anomaly live" button for on-stage demo control
- Model retraining loop on confirmed FA outcomes
- Cohort-level heatmap visualization across an entire lot
- Configurable per-parameter alert thresholds and ensemble weighting
- Email/SMS alert dispatch via a queued worker
- Multi-run comparison view (this lot vs. historical lots of the same part number)
- Predictive "time-to-flag" estimate (estimated hours before a drifting device would breach hard spec)
- Explainability chatbot ("Ask why this device was flagged" using the SHAP output + an LLM summarizer)
- Digital twin replay mode — scrub back and forward through a completed run's full timeline
- Mobile-responsive PWA shell for floor operators
- Role-based approval chain (Engineer flags → QA Manager approves final disposition)

---

## 7. Where Each Specification Parameter Shows Up

- **Clarity** — Section 3.1 and 5.13 describe the product in single-meaning sentences and name the primary user (reliability engineer) and the primary workflow motion (run → score → alert → disposition).
- **Completeness** — This document covers domain context, stack, data strategy, ML architecture, database schema, API contract, folder structure, UI, security, and a hackathon-specific execution plan.
- **Consistency** — The five anomaly classes defined in 5.2 map 1:1 to the model outputs in 5.3, the alert payloads in 5.5, and the demo script in Section 9.
- **Concrete Technology Choices** — Section 5.1 locks explicit dependencies (TimescaleDB, Isolation Forest, LSTM Autoencoder, SHAP, MQTT/Mosquitto) eliminating ambiguity for every team member.
- **Structured Sections** — Heading levels organize details into scannable sub-domains for both human reviewers and any AI coding agent assisting the build.
- **Phased Delivery** — Section 5.10 breaks the 36-hour build into six sequential, demo-checkpointed phases.
- **Authoritative Tone** — "Must," "shall," and explicit fields (not "some ML model") throughout Section 5.
- **Demo-Readiness** — Section 9 maps every feature back to a specific, judge-visible moment in the pitch.

---

## 8. Hackathon Execution Playbook

### 8.1 Team Roles

| Role | Owns |
|---|---|
| Team Lead / Backend | API, database schema, run lifecycle, auth |
| ML Engineer | Synthetic data generator, ensemble models, SHAP explainability, FastAPI service |
| Frontend Engineer | Dashboard, run monitor, device deep-dive, charts |
| Full-Stack / Real-Time | MQTT bridge, Socket.IO, alerting, reporting |
| Presenter / Designer | Pitch deck, UI polish, demo script rehearsal, judge Q&A prep |

### 8.2 36-Hour Build Timeline

| Hours | Milestone |
|---|---|
| 0–4 | Repo, Docker Compose, auth, DB schema, synthetic generator skeleton |
| 4–10 | MQTT ingestion → TimescaleDB → Socket.IO live passthrough working end-to-end |
| 10–18 | Isolation Forest + drift detector + LSTM Autoencoder trained and scoring live data |
| 18–26 | Dashboard, run monitor, device deep-dive, alert timeline wired to live data |
| 26–30 | Disposition workflow, PDF report, SHAP explainability panel |
| 30–34 | Model performance page, manual anomaly-injection demo control, deployment |
| 34–36 | Pitch rehearsal, bug bash, backup video recording of the demo |

### 8.3 Judging Criteria Alignment (SIH Rubric)

| Typical SIH Criterion | How SentinelBurn AI Delivers |
|---|---|
| Innovation & Novelty | Ensemble of three complementary anomaly-detection paradigms (point, trend, sequence) rather than a single classifier or static threshold; explicit cohort-outlier detection class most systems ignore |
| Technical Feasibility | Fully working, deployed, end-to-end pipeline with real ingestion protocol (MQTT), not a mocked dashboard |
| Impact & Usefulness | Directly targets an ISRO-stated reliability bottleneck; reduces time-to-detect for latent defects, improves flight-hardware safety, reduces costly late-stage failure analysis |
| Scalability | Same MQTT topic schema works for simulator or real DAQ hardware; TimescaleDB scales to high-frequency, multi-year telemetry retention |
| Presentation & Demo Quality | Judge-triggerable simulator + manual anomaly-injection button for a guaranteed live "wow" moment |
| Measurable Results | Ground-truth labelled synthetic dataset lets the team **quote real precision/recall/F1 numbers**, not just claims |

### 8.4 Novelty & Differentiators

1. **Ensemble over single-model** — explicitly framed and justified (Section 5.3), not just "we used ML."
2. **Ground-truth evaluation** — most hackathon anomaly-detection demos cannot prove their model works; this one can, live, with a confusion matrix.
3. **Explainability-first** — every alert carries a SHAP-based reason, addressing the real-world adoption blocker of "black box" AI in aerospace quality workflows.
4. **Audit-grade traceability** — hash-chained disposition log speaks directly to ISRO's actual compliance culture, not just a generic CRUD app.
5. **Hardware-ready architecture** — the same ingestion contract accepts a real ESP32 sensor bridge, proving this is not a demo-only toy.

### 8.5 Feasibility & Cost Justification

All components are open-source and run locally or on free-tier cloud services for the hackathon; the only optional hardware cost is an ESP32 dev board (~₹400) and an INA219/DHT22 sensor pair (~₹300), fully optional and not required for the core demo. Production deployment at an ISRO screening centre would integrate against existing DAQ/PLC systems via the same MQTT bridge pattern, requiring no change to plant floor equipment.

### 8.6 Risk Register & Fallback Plans

| Risk | Fallback |
|---|---|
| LSTM training takes too long during the hackathon | Pre-train offline before the event; ship frozen weights; only fine-tune live if time allows |
| Live MQTT demo fails on stage (network) | Local Docker Compose stack runs fully offline; no external network dependency |
| Judges want to see a "hard" anomaly caught | Manual anomaly-injection endpoint (Section 5.8) guarantees a live, on-demand flagged event |
| Time runs short before Phase 6 | Sections 6's "Must-Have" list is fully demoable alone; bonus features are cleanly separable and never block the core story |

---

## 9. Pitch Deck & Demo Script Structure

1. **Problem (30s)** — Burn-in generates huge telemetry volumes reviewed manually with static thresholds; subtle drift and cohort-outlier failures slip through, risking on-orbit failure.
2. **Solution (30s)** — SentinelBurn AI: real-time, explainable, multi-model anomaly detection for every device in every burn-in run.
3. **Live Demo (2 min)** — Start a run → live telemetry streams in → trigger a manual anomaly injection → watch the alert fire in under a second with a SHAP explanation → open device deep-dive → disposition the device → show the generated PDF report.
4. **Under the Hood (45s)** — One slide showing the ensemble architecture (Section 5.3) and one slide showing the measured precision/recall against the labelled synthetic dataset.
5. **Impact & Scalability (30s)** — Same architecture plugs into real DAQ hardware; reduces failure-analysis turnaround; strengthens flight-hardware reliability documentation.
6. **Close (15s)** — Call back to the ISRO problem statement title verbatim, reinforcing direct alignment.

---

## 10. Codex / AI Coding Agent Implementation Instructions

If any part of this build is delegated to an AI coding agent (Codex, Copilot, Claude Code), instruct it to: build phase by phase per Section 5.10; follow the folder structure in Section 5.9 strictly; keep controllers thin and push logic into services; keep the ML microservice fully decoupled behind the `/ml/*` contract; never call the database directly from a controller; treat every secret as an environment variable; use in-memory/local fallbacks for Postgres/Redis/MQTT so local development always works even without Docker; emit a Socket.IO event for every scoring stage (baseline/point/drift/sequence/ensemble); write one `run_audit_log` row per state transition; and report the list of files created or changed at the end of every phase.

---

## 11. Why a Single Spec Is Not Enough

This document outlines the full architecture, but two subsystems will benefit from short living sub-specs as the build progresses: the **ensemble scoring/calibration logic** (exact weighting and threshold tuning against the synthetic ground truth) and the **hash-chained audit log format** (exact hash construction and verification procedure). Treat this specification as a living document — update it the moment a phase's implementation diverges from what is written here, so the pitch deck never contradicts the running code.

---

## 12. Closing Thought

Spec Driven Development shifts hackathon effort from writing code to defining intent. For a problem statement as technically dense as SIH26170 — spanning reliability engineering, streaming data systems, and multi-model machine learning — a clear specification is the difference between a team that argues about scope at hour 30 and a team that spends hour 30 rehearsing a pitch that already matches a working, explainable, judge-triggerable demo.

---

## Appendix A — Core Database Schema (SQL DDL)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN
        ('admin','qa_manager','reliability_engineer','operator','fa_engineer')),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number VARCHAR(80) NOT NULL,
    manufacturer VARCHAR(120) NOT NULL,
    date_code VARCHAR(20),
    spec_reference VARCHAR(120),
    quantity INT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID REFERENCES lots(id),
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN
        ('created','running','paused','completed','under_review','dispositioned','archived','aborted')),
    speed_multiplier NUMERIC DEFAULT 1.0,
    anomaly_injection_config JSONB,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES runs(id),
    device_serial VARCHAR(60) NOT NULL,
    channel_id INT NOT NULL,
    cohort_baseline_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- TimescaleDB hypertable for high-frequency telemetry
CREATE TABLE telemetry_samples (
    time TIMESTAMPTZ NOT NULL,
    run_id UUID NOT NULL,
    device_id UUID NOT NULL,
    voltage NUMERIC,
    current NUMERIC,
    leakage_current NUMERIC,
    temperature NUMERIC
);
SELECT create_hypertable('telemetry_samples', 'time');
CREATE INDEX idx_telemetry_device ON telemetry_samples (device_id, time DESC);

CREATE TABLE anomaly_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES runs(id),
    device_id UUID REFERENCES devices(id),
    ts TIMESTAMPTZ NOT NULL,
    point_score NUMERIC,
    drift_score NUMERIC,
    sequence_score NUMERIC,
    ensemble_score NUMERIC,
    contributing_features_json JSONB
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES runs(id),
    device_id UUID REFERENCES devices(id),
    score NUMERIC NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('info','warning','critical')),
    message TEXT,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dispositions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id),
    decision VARCHAR(20) CHECK (decision IN ('accept','reject','hold_fa')),
    engineer_id UUID REFERENCES users(id),
    comment TEXT,
    decided_at TIMESTAMPTZ DEFAULT now()
);

-- Append-only, hash-chained audit trail
CREATE TABLE run_audit_log (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID REFERENCES runs(id),
    event_type VARCHAR(60) NOT NULL,
    actor_id UUID REFERENCES users(id),
    from_state VARCHAR(20),
    to_state VARCHAR(20),
    prev_hash CHAR(64),
    row_hash CHAR(64) NOT NULL,
    payload_json JSONB,
    timestamp TIMESTAMPTZ DEFAULT now()
);
-- Application-level rule: row_hash = SHA256(prev_hash || payload_json || timestamp)
-- DB role for the API user is granted INSERT + SELECT only on run_audit_log (no UPDATE/DELETE).

CREATE TABLE model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(60),
    version VARCHAR(20),
    trained_at TIMESTAMPTZ,
    precision_score NUMERIC,
    recall_score NUMERIC,
    f1_score NUMERIC,
    artifact_path TEXT
);
```

## Appendix B — Sample MQTT Telemetry Payload

Topic: `sentinelburn/telemetry/{runId}/{deviceId}`

```json
{
  "runId": "8f1c2e3a-9b4d-4e2f-8a1b-1234567890ab",
  "deviceId": "d-0142",
  "deviceSerial": "HMC-2026-0142",
  "channelId": 14,
  "timestamp": "2026-09-03T10:42:17.331Z",
  "readings": {
    "voltage": 5.021,
    "current": 0.184,
    "leakageCurrent": 0.0032,
    "temperature": 124.8
  },
  "chamberSetpoint": 125.0,
  "elapsedHours": 26.4
}
```

## Appendix C — Sample Anomaly Score & Alert Payload (Socket.IO `anomaly:flagged`)

```json
{
  "runId": "8f1c2e3a-9b4d-4e2f-8a1b-1234567890ab",
  "deviceId": "d-0142",
  "deviceSerial": "HMC-2026-0142",
  "timestamp": "2026-09-03T10:42:17.331Z",
  "scores": {
    "pointScore": 0.41,
    "driftScore": 0.87,
    "sequenceScore": 0.63,
    "ensembleScore": 78
  },
  "severity": "critical",
  "anomalyClassGuess": "gradual_drift",
  "explanation": {
    "summary": "Leakage current on Channel 14 deviated 3.2 sigma from cohort trend starting at hour 26.",
    "topContributingFeatures": [
      { "feature": "leakage_current_slope_6h", "shapValue": 0.52 },
      { "feature": "leakage_current_delta_vs_cohort", "shapValue": 0.31 },
      { "feature": "temperature_variance_1h", "shapValue": 0.09 }
    ]
  }
}
```

## Appendix D — Ensemble Scoring Pseudocode

```python
def score_device(sample_window: pd.DataFrame, baseline: dict, cohort_stats: dict) -> dict:
    """
    sample_window: rolling window of the device's last N samples
    baseline: this device's own established normal envelope
    cohort_stats: mean/std across the whole lot at this elapsed time
    """
    point_score = isolation_forest.decision_function(sample_window.iloc[[-1]])
    point_score = normalize(point_score)  # -> 0..1

    residuals = stl_decompose(sample_window["leakage_current"]).resid
    drift_score = mann_kendall_trend_strength(residuals)  # -> 0..1

    seq_input = to_tensor(sample_window[FEATURE_COLUMNS])
    reconstruction = lstm_autoencoder(seq_input)
    sequence_score = normalize(mse(seq_input, reconstruction))  # -> 0..1

    weights = {"point": 0.3, "drift": 0.4, "sequence": 0.3}
    ensemble_raw = (
        weights["point"] * point_score
        + weights["drift"] * drift_score
        + weights["sequence"] * sequence_score
    )
    ensemble_score = round(ensemble_raw * 100, 1)  # -> 0..100

    return {
        "point_score": point_score,
        "drift_score": drift_score,
        "sequence_score": sequence_score,
        "ensemble_score": ensemble_score,
    }
```

## Appendix E — Synthetic Anomaly Class Definitions (for the data generator)

| Class | Generation Rule | Ground-Truth Label |
|---|---|---|
| Healthy | `value = baseline + N(0, sigma_noise) + tiny_linear_aging_term` | `is_anomaly = 0` |
| Sudden Shift | Healthy profile until `t_inject`, then `value += step_magnitude` permanently | `is_anomaly = 1`, `class = sudden_shift` |
| Gradual Drift | `value += k * (t - t_inject)^1.5` for `t > t_inject` (accelerating divergence) | `class = gradual_drift` |
| Intermittent Spike | Healthy profile with short high-variance bursts of random duration/frequency after `t_inject` | `class = intermittent_spike` |
| Cohort Outlier | Value stays within absolute spec limits, but is offset from the lot mean by `> 2.5 * cohort_sigma` throughout | `class = cohort_outlier` |
| Thermal Lag | Temperature channel response time constant increased by a configurable factor relative to chamber setpoint changes | `class = thermal_lag` |

Every generated device row carries `is_anomaly`, `class`, and `t_inject` as hidden ground-truth columns (excluded from the model's feature set, used only for the Section 8.3/9 evaluation metrics and the `/models` performance page).

## Appendix F — Environment Variables Reference

```
# Server
PORT=4000
JWT_SECRET=
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgres://user:pass@localhost:5432/sentinelburn
REDIS_URL=redis://localhost:6379
MQTT_BROKER_URL=mqtt://localhost:1883

# ML Service
ML_SERVICE_URL=http://localhost:8000
MODEL_ARTIFACT_DIR=/app/artifacts

# Simulator
SIM_DEFAULT_DEVICE_COUNT=200
SIM_DEFAULT_ANOMALY_RATE=0.05
SIM_DEFAULT_SPEED_MULTIPLIER=60
```

## Appendix G — Glossary

- **DUT** — Device Under Test.
- **Burn-In** — Extended operation of a component under stress conditions to induce and catch early-life (infant mortality) failures.
- **PBEIT** — Post Burn-In Electrical Test; parametric re-measurement after burn-in.
- **FA** — Failure Analysis; root-cause investigation of a rejected/flagged device.
- **Cohort** — The full set of devices in the same lot/run, used as a comparative baseline.
- **Ensemble Model** — A combination of multiple independent models whose outputs are fused into a single decision, improving robustness over any single model.
- **SHAP (SHapley Additive exPlanations)** — A game-theoretic method for attributing a model's prediction to its input features, used here to explain why a device was flagged.
- **Hash-Chained Log** — An append-only log where each row's hash includes the previous row's hash, making retroactive tampering cryptographically detectable.
