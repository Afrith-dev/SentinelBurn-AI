"""
Ensemble Anomaly Detection Fusion Engine
Implements Section 5.3 Stage 5 of SIH26170.
Fuses Point, Drift, and Sequence anomaly detectors into a single calibrated
0–100 Anomaly Confidence Score with automated severity categorization.
"""

from typing import Dict, List, Optional
import numpy as np
from .isolation_forest import PointAnomalyDetector
from .drift_detector import DriftAnomalyDetector
from .sequence_autoencoder import SequenceAnomalyDetector

class EnsembleAnomalyDetector:
    def __init__(self):
        self.point_detector = PointAnomalyDetector()
        self.drift_detector = DriftAnomalyDetector()
        self.sequence_detector = SequenceAnomalyDetector()
        
        # Calibration weights per Appendix D
        self.weights = {
            "point": 0.35,
            "drift": 0.40,
            "sequence": 0.25
        }

    def score_device(
        self,
        current_reading: Dict,
        history_window: List[Dict],
        cohort_stats: Optional[Dict] = None
    ) -> Dict:
        """
        Fuses predictions across all 3 models plus cohort envelope deviation.
        Returns full score payload according to Appendix C & D.
        """
        # 1. Point Anomaly Score (Isolation Forest)
        point_score = self.point_detector.score_sample(current_reading)

        # 2. Drift / Trend Score (Mann-Kendall + STL Residuals)
        drift_score = self.drift_detector.score_window(history_window)

        # 3. Sequence Anomaly Score (Autoencoder Reconstruction MSE)
        sequence_score = self.sequence_detector.score_sequence(history_window)

        # 4. Cohort Outlier Check (Z-score against lot mean)
        cohort_factor = 0.0
        if cohort_stats and "leakageMean" in cohort_stats and "leakageStd" in cohort_stats:
            leakage = current_reading.get("leakageCurrent", 0.0025)
            mean = cohort_stats["leakageMean"]
            std = max(cohort_stats["leakageStd"], 1e-5)
            z_score = abs(leakage - mean) / std
            if z_score > 2.5:
                cohort_factor = min(1.0, (z_score - 2.5) / 2.0)

        # Weighted combination
        raw_ensemble = (
            self.weights["point"] * point_score +
            self.weights["drift"] * drift_score +
            self.weights["sequence"] * sequence_score +
            0.20 * cohort_factor
        )
        
        # Scale to 0 - 100 Anomaly Confidence Score
        ensemble_score = float(np.clip(round(raw_ensemble * 100.0, 1), 0.0, 100.0))

        # Severity categorization
        if ensemble_score >= 65.0:
            severity = "critical"
        elif ensemble_score >= 40.0:
            severity = "warning"
        elif ensemble_score >= 25.0:
            severity = "info"
        else:
            severity = "nominal"

        # Determine most likely anomaly class
        anomaly_class_guess = self._classify_anomaly(
            point_score=point_score,
            drift_score=drift_score,
            sequence_score=sequence_score,
            cohort_factor=cohort_factor,
            history_window=history_window
        )

        return {
            "pointScore": round(point_score, 4),
            "driftScore": round(drift_score, 4),
            "sequenceScore": round(sequence_score, 4),
            "ensembleScore": ensemble_score,
            "severity": severity,
            "anomalyClassGuess": anomaly_class_guess,
            "weights": self.weights
        }

    def _classify_anomaly(
        self,
        point_score: float,
        drift_score: float,
        sequence_score: float,
        cohort_factor: float,
        history_window: List[Dict]
    ) -> Optional[str]:
        """Identifies signature class among the 5 target anomalies"""
        if drift_score > 0.55:
            return "gradual_drift"
        if cohort_factor > 0.6:
            return "cohort_outlier"
        if sequence_score > 0.6:
            # Check if temp variance is elevated (thermal lag) or spike bursts
            if len(history_window) >= 5:
                temps = [h.get("temperature", 125.0) for h in history_window[-6:]]
                temp_diff = abs(temps[-1] - np.mean(temps))
                if temp_diff > 1.0:
                    return "thermal_lag"
            return "intermittent_spike"
        if point_score > 0.65:
            return "sudden_shift"
        return "nominal"
