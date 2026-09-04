"""
Drift & Trend Anomaly Detector
Implements Section 5.3 Stage 3 of the SIH26170 Specification.
Detects subtle, accelerating gradual divergence and non-linear parametric drift
using Moving Residual Decomposition and the Mann-Kendall non-parametric trend test.
"""

import numpy as np
from scipy import stats
from typing import List, Dict

class DriftAnomalyDetector:
    def __init__(self, min_window_size: int = 10):
        self.min_window_size = min_window_size

    def mann_kendall_score(self, series: np.ndarray) -> float:
        """
        Computes normalized trend strength score [0.0, 1.0]
        using Kendall's tau correlation against time indices.
        """
        n = len(series)
        if n < self.min_window_size:
            return 0.0

        time_idx = np.arange(n)
        tau, p_value = stats.kendalltau(time_idx, series)
        
        if np.isnan(tau):
            return 0.0

        # High positive tau with low p-value indicates statistically significant upward drift
        if tau > 0 and p_value < 0.05:
            # Scaled by confidence (1 - p_value)
            strength = tau * (1.0 - p_value)
            return float(np.clip(strength, 0.0, 1.0))
        return 0.0

    def score_window(self, history_samples: List[Dict]) -> float:
        """
        Evaluates a sliding window of historical readings for a single DUT.
        history_samples is a list of readings ordered by timestamp.
        """
        if len(history_samples) < self.min_window_size:
            return 0.0

        # Extract leakage current trajectory (the primary wear-out parameter)
        leakages = np.array([s.get("leakageCurrent", 0.0025) for s in history_samples])
        
        # 1. Check relative change from baseline (first 20% vs last 20%)
        initial_slice = leakages[:max(3, len(leakages) // 5)]
        latest_slice = leakages[-max(3, len(leakages) // 5):]
        
        baseline_mean = np.mean(initial_slice)
        latest_mean = np.mean(latest_slice)
        
        relative_increase = (latest_mean - baseline_mean) / max(baseline_mean, 1e-6)
        
        # 2. Mann-Kendall trend test on raw leakage
        trend_score = self.mann_kendall_score(leakages)
        
        # 3. Acceleration detection (second derivative of moving averages)
        if len(leakages) >= 15:
            # Moving average of window 5
            smoothed = np.convolve(leakages, np.ones(5)/5, mode='valid')
            diff1 = np.diff(smoothed)
            diff2 = np.diff(diff1)
            acceleration = np.mean(diff2[-5:]) if len(diff2) >= 5 else 0.0
            accel_factor = np.clip(acceleration * 5000.0, 0.0, 0.5)
        else:
            accel_factor = 0.0

        # Combine trend test and relative magnitude
        # A 50% drift increase + significant trend yields high score
        magnitude_factor = float(np.clip(relative_increase / 0.6, 0.0, 1.0))
        
        combined_drift = 0.55 * trend_score + 0.35 * magnitude_factor + 0.10 * accel_factor
        return float(np.clip(combined_drift, 0.0, 1.0))
