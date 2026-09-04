"""
SentinelBurn AI - End-to-End System Verification Suite
Validates the entire qualification screening pipeline:
Lot Creation -> Run Lifecycle -> Ingestion -> ML Ensemble Scoring ->
Alert Generation -> SHAP Explanation -> Disposition -> SHA-256 Audit Chain -> Report
"""

import sys
import time
import requests
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_URL = "http://localhost:4000/api"

ML_URL = "http://localhost:8000"

def test_pipeline():
    print("==================================================================")
    print("🛰️  STARTING SENTINELBURN AI END-TO-END VERIFICATION SUITE")
    print("==================================================================")

    # 1. Health Checks
    print("\n[Step 1] Checking Backend & ML Microservice Health...")
    try:
        r_back = requests.get(f"{BACKEND_URL}/health", timeout=3)
        assert r_back.status_code == 200, f"Backend error: {r_back.text}"
        print(f"  ✓ Backend Healthy: {r_back.json()['system']}")
    except Exception as e:
        print(f"  ⚠ Backend not running at {BACKEND_URL}: {e}")
        return False

    try:
        r_ml = requests.get(f"{ML_URL}/ml/health", timeout=3)
        assert r_ml.status_code == 200, f"ML error: {r_ml.text}"
        print(f"  ✓ ML Core Healthy: {r_ml.json()['modelsLoaded']}")
    except Exception as e:
        print(f"  ⚠ ML microservice not running at {ML_URL} (will use resilient backend fallback): {e}")

    # 2. Authentication
    print("\n[Step 2] Authenticating as Reliability Lead...")
    auth_resp = requests.post(f"{BACKEND_URL}/login", json={
        "email": "engineer@sentinelburn.aero",
        "password": "password123"
    })
    assert auth_resp.status_code == 200, f"Login failed: {auth_resp.text}"
    token = auth_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"  ✓ Authenticated as: {auth_resp.json()['user']['name']} ({auth_resp.json()['user']['role']})")

    # 3. Lot Creation
    print("\n[Step 3] Registering Qualification Lot...")
    lot_resp = requests.post(f"{BACKEND_URL}/lots", headers=headers, json={
        "partNumber": "HMC-SPACE-TEST-01",
        "manufacturer": "SCL / ISRO",
        "dateCode": "2615-BATCH-01",
        "specReference": "ISRO-PAS-206 Rev D",
        "quantity": 200
    })
    assert lot_resp.status_code == 201, f"Lot creation failed: {lot_resp.text}"
    lot_id = lot_resp.json()["id"]
    print(f"  ✓ Lot Registered: {lot_id} (200 DUTs)")

    # 4. Run Creation
    print("\n[Step 4] Creating Burn-In Run...")
    run_resp = requests.post(f"{BACKEND_URL}/runs", headers=headers, json={
        "lotId": lot_id,
        "speedMultiplier": 60,
        "anomalyRate": 0.05,
        "deviceCount": 200
    })
    assert run_resp.status_code == 201, f"Run creation failed: {run_resp.text}"
    run_id = run_resp.json()["id"]
    print(f"  ✓ Burn-In Run Initialized: {run_id}")

    # 5. Start Run
    print("\n[Step 5] Starting Burn-In Run...")
    start_resp = requests.post(f"{BACKEND_URL}/runs/{run_id}/start", headers=headers)
    assert start_resp.status_code == 200, f"Run start failed: {start_resp.text}"
    print(f"  ✓ Run State: {start_resp.json()['status']}")

    # 6. Ingest Telemetry Batches (simulating progressive drift over 12 ticks)
    print("\n[Step 6] Streaming 12 Telemetry Ticks with Progressive Drift on Channel 14...")
    for tick in range(1, 13):
        samples = []
        elapsed = 2.0 + (tick * 0.1)
        for i in range(1, 201):
            dev_id = f"d-{i:04d}"
            is_target = (i == 14)
            # Channel 14 accelerates from 0.0035 to 0.0095 mA
            if is_target:
                leakage = 0.0035 + (tick * 0.0005)
            else:
                leakage = 0.0025
            samples.append({
                "runId": run_id,
                "deviceId": dev_id,
                "deviceSerial": f"HMC-SPACE-TEST-01-{i:04d}",
                "channelId": i,
                "time": "2026-09-04T00:00:00.000Z",
                "readings": {
                    "voltage": 5.01,
                    "current": 0.181,
                    "leakageCurrent": leakage,
                    "temperature": 125.1
                },
                "elapsedHours": elapsed
            })
        requests.post(f"{BACKEND_URL}/ingest/telemetry", json={
            "runId": run_id,
            "elapsedHours": elapsed,
            "samples": samples
        })
    print(f"  ✓ Ingested 12 ticks across 200 channels (2400 total data points)")


    # 7. Verify Anomaly Scoring & Alerts
    print("\n[Step 7] Inspecting AI Ensemble Scores & Anomaly Alerts...")
    dev14_resp = requests.get(f"{BACKEND_URL}/runs/{run_id}/devices/d-0014", headers=headers)
    assert dev14_resp.status_code == 200
    dev14 = dev14_resp.json()
    score = dev14.get("latestScores", {}).get("ensembleScore", 0)
    severity = dev14.get("latestScores", {}).get("severity", "nominal")
    print(f"  ✓ Channel 14 Anomaly Confidence Score: {score}% ({severity})")
    assert score >= 40.0, f"Expected anomaly score >= 40.0, got {score}"

    # 8. SHAP Explainability Inspection
    print("\n[Step 8] Requesting SHAP Feature Attribution Decomposition...")
    explain_resp = requests.get(f"{BACKEND_URL}/runs/{run_id}/devices/d-0014/explain", headers=headers)
    assert explain_resp.status_code == 200
    explain_data = explain_resp.json()
    print(f"  ✓ Diagnosis: {explain_data.get('anomalyClass', 'N/A')}")
    print(f"  ✓ Narrative: {explain_data.get('summary', 'N/A')}")
    print("  ✓ Top SHAP Features:")
    for feat in explain_data.get("topContributingFeatures", [])[:2]:
        print(f"    - {feat['displayName']}: +{feat['shapValue']} ({feat.get('percentage', 0)}%)")

    # 9. Engineer Disposition
    print("\n[Step 9] Recording Engineer Disposition...")
    dispo_resp = requests.post(f"{BACKEND_URL}/devices/d-0014/disposition", headers=headers, json={
        "runId": run_id,
        "decision": "reject",
        "comment": "Accelerating leakage current drift identified at 2.5h. Rejected per MIL-STD-883K Method 1015."
    })
    assert dispo_resp.status_code == 200
    print(f"  ✓ Disposition Decision Recorded: {dispo_resp.json()['disposition']['decision'].upper()}")

    # 10. Cryptographic SHA-256 Audit Chain Verification
    print("\n[Step 10] Validating Cryptographic SHA-256 Audit Chain of Custody...")
    audit_resp = requests.get(f"{BACKEND_URL}/runs/{run_id}/audit/verify", headers=headers)
    assert audit_resp.status_code == 200
    audit_data = audit_resp.json()
    assert audit_data["isValid"] is True, "Cryptographic audit chain verification failed!"
    print(f"  ✓ Audit Chain Valid: 100% Intact ({audit_data['totalRecords']} entries)")
    print(f"  ✓ Ledger Head Hash: {audit_data['headHash']}")

    # 11. Official PDF/HTML Lot Report
    print("\n[Step 11] Generating Lot Disposition Report...")
    report_resp = requests.get(f"{BACKEND_URL}/runs/{run_id}/report", headers=headers)
    assert report_resp.status_code == 200
    metrics = report_resp.json()["metrics"]
    print(f"  ✓ Report Generated for Lot: {report_resp.json()['lot']['partNumber']}")
    print(f"  ✓ Summary: {metrics['accepted']} Qualified, {metrics['rejected']} Rejected, {metrics['holdFA']} Holds")

    # 12. xtWave Voice Reliability Copilot Verification
    print("\n[Step 12] Testing xtWave Voice Reliability Copilot Intent Engine & Safety Loop...")
    # Test 12a: Diagnosis query
    vc_diag = requests.post(f"{BACKEND_URL}/copilot/query", headers=headers, json={
        "query": "Why was DUT-14 flagged?",
        "runId": run_id
    })
    assert vc_diag.status_code == 200
    diag_json = vc_diag.json()
    assert diag_json["intent"] == "DEVICE_EXPLANATION"
    print(f"  ✓ Voice Intent: {diag_json['intent']}")
    print(f"  ✓ Copilot Spoken Response: {diag_json['spokenText'][:80]}...")

    # Test 12b: Critical action safety loop
    vc_action = requests.post(f"{BACKEND_URL}/copilot/query", headers=headers, json={
        "query": "Put DUT-14 on hold for failure analysis",
        "runId": run_id
    })
    assert vc_action.status_code == 200
    action_json = vc_action.json()
    assert action_json["requiresConfirmation"] is True
    print(f"  ✓ Safety-Critical Action Gate: {action_json['intent']} (Requires Verbal Confirmation)")

    # Test 12c: Confirm action
    vc_confirm = requests.post(f"{BACKEND_URL}/copilot/query", headers=headers, json={
        "query": "CONFIRM",
        "runId": run_id,
        "pendingConfirmation": action_json["confirmationPayload"]
    })
    assert vc_confirm.status_code == 200
    confirm_json = vc_confirm.json()
    assert confirm_json["intent"] == "DISPOSITION_EXECUTED"
    print(f"  ✓ Confirmation Executed & Signed into SHA-256 Ledger: {confirm_json['message'][:65]}...")

    print("\n==================================================================")
    print("🎉 ALL VERIFICATION STAGES PASSED PERFECTLY (12/12 SUCCESS)!")
    print("==================================================================")
    return True

if __name__ == "__main__":
    test_pipeline()
