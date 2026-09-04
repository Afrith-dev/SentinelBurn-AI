"""
Isolation Forest Multivariate Point Anomaly Detector
Captures sudden shifts and cohort outliers across combined voltage, current, leakage, and temperature channels.
"""

import numpy as np
from sklearn.ensemble import IsolationForest

class PointAnomalyDetector:
    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self.model = IsolationForest(
            n_estimators=30,
            contamination=contamination,
            random_state=random_state,
            n_jobs=1  # Avoid Windows multiprocessing spawn delay
        )
        self.is_fitted = False
        self._fit_default_baseline()

    def _generate_synthetic_baseline(self, n_samples: int = 400) -> np.ndarray:
        """Generates representative nominal telemetry for pre-training"""
        np.random.seed(42)
        voltage = np.random.normal(5.0, 0.015, n_samples)
        current = np.random.normal(0.18, 0.003, n_samples)
        leakage = np.random.normal(0.0025, 0.0003, n_samples)
        leakage = np.clip(leakage, 0.001, 0.005)
        temperature = np.random.normal(125.0, 0.35, n_samples)
        return np.column_stack([voltage, current, leakage, temperature])

    def _fit_default_baseline(self):
        X = self._generate_synthetic_baseline()
        self.model.fit(X)
        self.is_fitted = True

    def score_sample(self, readings: dict) -> float:
        """
        Returns normalized point anomaly score in range [0.0, 1.0]
        Higher value indicates greater anomaly confidence.
        """
        features = np.array([[
            readings.get("voltage", 5.0),
            readings.get("current", 0.18),
            readings.get("leakageCurrent", 0.0025),
            readings.get("temperature", 125.0)
        ]])
        
        raw_score = self.model.decision_function(features)[0]
        calibrated = 1.0 / (1.0 + np.exp(8.0 * raw_score))
        return float(np.clip(calibrated, 0.0, 1.0))

    def batch_score(self, feature_matrix: np.ndarray) -> np.ndarray:
        raw_scores = self.model.decision_function(feature_matrix)
        calibrated = 1.0 / (1.0 + np.exp(8.0 * raw_scores))
        return np.clip(calibrated, 0.0, 1.0)
