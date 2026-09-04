"""
SentinelBurn AI - Telemetry Simulation Engine
Implements Section 5.2 and Appendix E of the SIH26170 ISRO Specification.
Generates realistic parametric telemetry across 200 Devices Under Test (DUTs)
with 5 calibrated anomaly classes and ground-truth labels.
"""

import math
import random
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional
import threading
import requests
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SentinelBurn Telemetry Simulator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Simulation Data Structures
# --------------------------------------------------------------------------

class DeviceConfig:
    def __init__(self, device_id: str, device_serial: str, channel_id: int):
        self.device_id = device_id
        self.device_serial = device_serial
        self.channel_id = channel_id
        
        # Nominal baselines with manufacturing variance
        self.base_voltage = 5.0 + random.gauss(0, 0.015)         # 5.0V ± 15mV
        self.base_current = 0.18 + random.gauss(0, 0.003)        # 180mA ± 3mA
        self.base_leakage = 0.0025 + abs(random.gauss(0, 0.0003))# 2.5µA baseline
        self.base_temp = 125.0 + random.gauss(0, 0.3)            # 125°C chamber
        
        # Nominal aging drift rate (tiny per hour)
        self.aging_rate_leakage = random.uniform(0.000005, 0.000015)
        
        # Anomaly configuration
        self.anomaly_class: Optional[str] = None  # None / sudden_shift / gradual_drift / intermittent_spike / cohort_outlier / thermal_lag
        self.is_anomaly: bool = False
        self.t_inject: float = 0.0  # In simulated elapsed hours
        self.injected_params: Dict = {}
        
        # State tracking
        self.current_leakage_shift = 0.0
        self.thermal_lag_state = self.base_temp

    def to_ground_truth(self) -> Dict:
        return {
            "deviceId": self.device_id,
            "deviceSerial": self.device_serial,
            "channelId": self.channel_id,
            "isAnomaly": self.is_anomaly,
            "anomalyClass": self.anomaly_class if self.is_anomaly else "healthy",
            "tInjectHours": self.t_inject if self.is_anomaly else None,
            "injectedParams": self.injected_params
        }


class SimulationState:
    def __init__(self):
        self.is_running: bool = False
        self.is_paused: bool = False
        self.run_id: Optional[str] = None
        self.device_count: int = 200
        self.anomaly_rate: float = 0.05
        self.speed_multiplier: float = 60.0  # 60x means 1 sec wall clock = 60 sec simulated
        self.elapsed_hours: float = 0.0
        self.chamber_setpoint: float = 125.0
        self.devices: Dict[str, DeviceConfig] = {}
        self.backend_url: str = "http://localhost:4000/api/ingest/telemetry"
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def configure_run(self, run_id: str, device_count: int = 200, anomaly_rate: float = 0.05, speed_multiplier: float = 60.0, backend_url: str = None):
        with self._lock:
            self.run_id = run_id
            self.device_count = device_count
            self.anomaly_rate = anomaly_rate
            self.speed_multiplier = speed_multiplier
            self.elapsed_hours = 0.0
            if backend_url:
                self.backend_url = backend_url
            self.devices = {}
            
            # 1. Initialize healthy device profiles
            for i in range(1, device_count + 1):
                d_id = f"d-{i:04d}"
                serial = f"HMC-2026-{i:04d}"
                self.devices[d_id] = DeviceConfig(d_id, serial, i)

            # 2. Assign 5% anomaly classes as specified in Section 5.2
            anomaly_classes = ["sudden_shift", "gradual_drift", "intermittent_spike", "cohort_outlier", "thermal_lag"]
            anomaly_count = max(1, int(device_count * anomaly_rate))
            anomaly_device_ids = random.sample(list(self.devices.keys()), anomaly_count)
            
            for idx, d_id in enumerate(anomaly_device_ids):
                dev = self.devices[d_id]
                dev.is_anomaly = True
                dev.anomaly_class = anomaly_classes[idx % len(anomaly_classes)]
                # Inject between 2.0 and 24.0 simulated hours
                dev.t_inject = round(random.uniform(2.0, 20.0), 1)
                
                if dev.anomaly_class == "sudden_shift":
                    dev.injected_params = {"step_magnitude": random.uniform(0.004, 0.009)}
                elif dev.anomaly_class == "gradual_drift":
                    dev.injected_params = {"drift_k": random.uniform(0.00015, 0.00035)}
                elif dev.anomaly_class == "intermittent_spike":
                    dev.injected_params = {"spike_variance": random.uniform(0.006, 0.015), "burst_probability": 0.35}
                elif dev.anomaly_class == "cohort_outlier":
                    # Elevated offset from the very beginning (>2.5 sigma from lot mean)
                    dev.injected_params = {"static_offset": random.uniform(0.0022, 0.0035)}
                    dev.base_leakage += dev.injected_params["static_offset"]
                    dev.t_inject = 0.0
                elif dev.anomaly_class == "thermal_lag":
                    dev.injected_params = {"lag_factor": 4.5}

    def generate_tick_readings(self) -> List[Dict]:
        """Generates one 5-second simulated sample across all DUTs"""
        samples = []
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Add slight periodic chamber oscillation (±0.2°C)
        chamber_temp = self.chamber_setpoint + 0.18 * math.sin(self.elapsed_hours * 2 * math.pi)

        for d_id, dev in self.devices.items():
            # 1. Voltage channel
            voltage_noise = random.gauss(0, 0.005)
            voltage = round(dev.base_voltage + voltage_noise, 4)

            # 2. Current channel
            current_noise = random.gauss(0, 0.001)
            current = round(dev.base_current + current_noise, 4)

            # 3. Leakage current channel (primary failure parameter)
            leakage_noise = random.gauss(0, 0.00008)
            normal_aging = dev.aging_rate_leakage * self.elapsed_hours
            leakage = dev.base_leakage + normal_aging + leakage_noise

            # 4. Temperature channel
            temp_noise = random.gauss(0, 0.15)
            device_temp = chamber_temp + temp_noise

            # Apply anomaly signatures if active for this device
            if dev.is_anomaly and self.elapsed_hours >= dev.t_inject:
                if dev.anomaly_class == "sudden_shift":
                    # Abrupt step increase
                    leakage += dev.injected_params.get("step_magnitude", 0.006)
                elif dev.anomaly_class == "gradual_drift":
                    # Accelerating divergence: k * (t - t_inject)^1.5
                    dt = self.elapsed_hours - dev.t_inject
                    leakage += dev.injected_params.get("drift_k", 0.0002) * (dt ** 1.5)
                elif dev.anomaly_class == "intermittent_spike":
                    # Intermittent bursts
                    if random.random() < dev.injected_params.get("burst_probability", 0.35):
                        leakage += abs(random.gauss(0, dev.injected_params.get("spike_variance", 0.008)))
                elif dev.anomaly_class == "thermal_lag":
                    # Abnormal thermal response delay
                    lag_factor = dev.injected_params.get("lag_factor", 4.0)
                    dev.thermal_lag_state += (chamber_temp - dev.thermal_lag_state) / (lag_factor * 2.0)
                    device_temp = dev.thermal_lag_state + temp_noise

            # Floor values to realistic boundaries
            voltage = max(0.0, voltage)
            current = max(0.0, current)
            leakage = max(0.0001, round(leakage, 6))
            device_temp = round(device_temp, 2)

            sample = {
                "runId": self.run_id,
                "deviceId": dev.device_id,
                "deviceSerial": dev.device_serial,
                "channelId": dev.channel_id,
                "timestamp": now_iso,
                "readings": {
                    "voltage": voltage,
                    "current": current,
                    "leakageCurrent": leakage,
                    "temperature": device_temp
                },
                "chamberSetpoint": self.chamber_setpoint,
                "elapsedHours": round(self.elapsed_hours, 2)
            }
            samples.append(sample)

        return samples


sim_state = SimulationState()


def _sim_loop():
    """Background simulator thread streaming samples every tick"""
    print(f"[*] Simulation loop started for run {sim_state.run_id}")
    sample_interval_sim_sec = 5.0  # Sample every 5 simulated seconds
    
    while sim_state.is_running:
        if sim_state.is_paused:
            time.sleep(0.5)
            continue
            
        start_time = time.time()
        
        # Calculate time progression
        # e.g., 60x speed multiplier means 1 real second = 60 simulated seconds (0.0166 simulated hours)
        dt_sim_seconds = sample_interval_sim_sec
        dt_real_seconds = dt_sim_seconds / sim_state.speed_multiplier
        
        # Advance simulation clock
        sim_state.elapsed_hours += (dt_sim_seconds / 3600.0)
        
        samples = sim_state.generate_tick_readings()
        
        # Dispatch to backend in batch
        try:
            payload = {
                "runId": sim_state.run_id,
                "elapsedHours": round(sim_state.elapsed_hours, 2),
                "samples": samples
            }
            # Post to backend ingestion endpoint
            requests.post(sim_state.backend_url, json=payload, timeout=2.0)
        except Exception as e:
            # Backend might not be up yet or connection error; continue gracefully
            pass

        # Maintain proper timing
        execution_duration = time.time() - start_time
        sleep_time = max(0.05, dt_real_seconds - execution_duration)
        time.sleep(sleep_time)

    print(f"[*] Simulation loop terminated for run {sim_state.run_id}")


# --------------------------------------------------------------------------
# API Models and Endpoints
# --------------------------------------------------------------------------

class StartSimulationRequest(BaseModel):
    runId: str = Field(..., description="UUID of the Burn-In Run")
    deviceCount: int = Field(200, ge=1, le=500)
    anomalyRate: float = Field(0.05, ge=0.0, le=0.5)
    speedMultiplier: float = Field(60.0, ge=1.0, le=3600.0)
    backendUrl: Optional[str] = "http://localhost:4000/api/ingest/telemetry"


class InjectAnomalyRequest(BaseModel):
    deviceId: str = Field(..., description="Target device e.g. d-0042")
    anomalyClass: str = Field(..., description="sudden_shift | gradual_drift | intermittent_spike | cohort_outlier | thermal_lag")
    magnitude: Optional[float] = None


@app.get("/simulator/status")
def get_status():
    return {
        "isRunning": sim_state.is_running,
        "isPaused": sim_state.is_paused,
        "runId": sim_state.run_id,
        "deviceCount": sim_state.device_count,
        "anomalyRate": sim_state.anomaly_rate,
        "speedMultiplier": sim_state.speed_multiplier,
        "elapsedHours": round(sim_state.elapsed_hours, 2),
        "totalConfiguredDevices": len(sim_state.devices)
    }


@app.post("/simulator/start")
def start_simulation(req: StartSimulationRequest):
    if sim_state.is_running:
        sim_state.is_running = False
        if sim_state._thread and sim_state._thread.is_alive():
            sim_state._thread.join(timeout=2.0)

    sim_state.configure_run(
        run_id=req.runId,
        device_count=req.deviceCount,
        anomaly_rate=req.anomalyRate,
        speed_multiplier=req.speedMultiplier,
        backend_url=req.backendUrl
    )
    sim_state.is_running = True
    sim_state.is_paused = False
    
    sim_state._thread = threading.Thread(target=_sim_loop, daemon=True)
    sim_state._thread.start()

    return {
        "status": "started",
        "runId": req.runId,
        "deviceCount": req.deviceCount,
        "anomalyRate": req.anomalyRate,
        "speedMultiplier": req.speedMultiplier
    }


@app.post("/simulator/pause")
def pause_simulation():
    if not sim_state.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running")
    sim_state.is_paused = not sim_state.is_paused
    return {"status": "paused" if sim_state.is_paused else "resumed"}


@app.post("/simulator/stop")
def stop_simulation():
    sim_state.is_running = False
    sim_state.is_paused = False
    return {"status": "stopped", "elapsedHours": round(sim_state.elapsed_hours, 2)}


@app.post("/simulator/inject")
def inject_anomaly(req: InjectAnomalyRequest):
    """
    On-stage demo trigger: Manually force an anomaly into a specific device immediately.
    Guarantees a live 'wow' moment for judges as specified in Section 8.3 & 8.6.
    """
    if req.deviceId not in sim_state.devices:
        raise HTTPException(status_code=404, detail=f"Device {req.deviceId} not found")
    
    dev = sim_state.devices[req.deviceId]
    dev.is_anomaly = True
    dev.anomaly_class = req.anomalyClass
    dev.t_inject = sim_state.elapsed_hours
    
    if req.anomalyClass == "sudden_shift":
        dev.injected_params = {"step_magnitude": req.magnitude or 0.0075}
    elif req.anomalyClass == "gradual_drift":
        dev.injected_params = {"drift_k": req.magnitude or 0.0003}
    elif req.anomalyClass == "intermittent_spike":
        dev.injected_params = {"spike_variance": req.magnitude or 0.012, "burst_probability": 0.6}
    elif req.anomalyClass == "cohort_outlier":
        dev.injected_params = {"static_offset": req.magnitude or 0.0035}
        dev.base_leakage += dev.injected_params["static_offset"]
    elif req.anomalyClass == "thermal_lag":
        dev.injected_params = {"lag_factor": req.magnitude or 5.0}

    return {
        "status": "injected",
        "deviceId": req.deviceId,
        "anomalyClass": req.anomalyClass,
        "injectedAtElapsedHours": round(sim_state.elapsed_hours, 2),
        "params": dev.injected_params
    }


@app.get("/simulator/ground-truth/{run_id}")
def get_ground_truth(run_id: str):
    """Returns ground truth labels for computing precision, recall, and confusion matrix"""
    if sim_state.run_id != run_id and sim_state.run_id is not None:
        raise HTTPException(status_code=404, detail="Run ID does not match active simulation")
    
    return {
        "runId": run_id,
        "totalDevices": len(sim_state.devices),
        "groundTruth": [dev.to_ground_truth() for dev in sim_state.devices.values()]
    }


if __name__ == "__main__":
    import uvicorn
    print("[*] Starting SentinelBurn Telemetry Simulator on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
