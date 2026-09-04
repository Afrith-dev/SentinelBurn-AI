"""
Sequence Reconstruction Autoencoder Detector
Implements Section 5.3 Stage 4 of the SIH26170 Specification.
Evaluates temporal reconstruction error on sequential windows of telemetry
to identify intermittent spikes, high-frequency bursts, and thermal response lags.
"""

import numpy as np
from sklearn.decomposition import PCA
from typing import List, Dict

class SequenceAnomalyDetector:
    def __init__(self, sequence_length: int = 12):
        self.sequence_length = sequence_length
        self.feature_dim = 4  # voltage, current, leakage, temp
        self.model = None
        self._train_default_autoencoder()

    def _train_default_autoencoder(self):
        """
        Fits a high-performance linear projection autoencoder (PCA subspace reconstruction)
        on nominal smooth burn-in sequences. Initializes in <0.05s.
        """
        np.random.seed(42)
        n_samples = 300
        
        # Synthesize nominal sequences: 12 steps x 4 features = 48 dimensions
        X_nominal = []
        for _ in range(n_samples):
            v = np.random.normal(5.0, 0.01, self.sequence_length)
            c = np.random.normal(0.18, 0.002, self.sequence_length)
            l = np.random.normal(0.0025, 0.0002, self.sequence_length)
            t = np.random.normal(125.0, 0.25, self.sequence_length)
            seq = np.column_stack([v, c, l, t]).flatten()
            X_nominal.append(seq)
        
        X_nominal = np.array(X_nominal)
        
        # Retain top 8 principal components (subspace representing nominal smooth progression)
        self.model = PCA(n_components=8, random_state=42)
        self.model.fit(X_nominal)

    def score_sequence(self, history_samples: List[Dict]) -> float:
        """
        Evaluates reconstruction error over the most recent window of sequence_length samples.
        Returns normalized reconstruction anomaly score [0.0, 1.0].
        """
        if len(history_samples) < self.sequence_length:
            return 0.0

        # Take last sequence_length samples
        window = history_samples[-self.sequence_length:]
        
        features = []
        for s in window:
            r = s.get("readings", s)
            features.append([
                r.get("voltage", 5.0),
                r.get("current", 0.18),
                r.get("leakageCurrent", 0.0025),
                r.get("temperature", 125.0)
            ])
            
        seq_array = np.array(features).flatten().reshape(1, -1)
        
        # Project into latent space and reconstruct back
        latent = self.model.transform(seq_array)
        reconstructed = self.model.inverse_transform(latent)
        
        # Weighted mean squared reconstruction error
        # Weight leakage and temperature channels higher in MSE
        weights = np.tile([1.0, 2.0, 500.0, 0.5], self.sequence_length)
        weighted_diff = (seq_array - reconstructed)[0] * weights
        mse = float(np.mean(weighted_diff ** 2))
        
        # Normalize MSE to 0..1 range with smooth saturation
        score = 1.0 - np.exp(-mse * 20.0)
        return float(np.clip(score, 0.0, 1.0))
