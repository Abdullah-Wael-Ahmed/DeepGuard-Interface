"""
Train a window-based autoencoder for behavioral anomaly detection.

Generates synthetic normal traffic windows, trains an autoencoder on
aggregated features, and saves the model + scaler + metadata.

Run:
    python train_window_autoencoder.py
"""

import os
import json
import numpy as np
import joblib
from sklearn.preprocessing import RobustScaler

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'          # suppress TF info logs
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# ─── Paths ────────────────────────────────────────────────
MODEL_DIR      = 'model'
MODEL_PATH     = os.path.join(MODEL_DIR, 'window_autoencoder.keras')
SCALER_PATH    = os.path.join(MODEL_DIR, 'window_scaler.pkl')
METADATA_PATH  = os.path.join(MODEL_DIR, 'window_metadata.json')

# ─── Feature definitions ─────────────────────────────────
FEATURE_NAMES = [
    'conn_count',
    'unique_dst_ports',
    'unique_dst_ips',
    'syn_ratio',
    'failed_ratio',
    'bytes_total',
    'packets_total',
    'avg_duration',
    'connections_per_sec',
    'avg_bytes_per_flow',
    'dst_port_entropy',
    'dst_ip_entropy',
]

WINDOW_SIZE = 30   # seconds

# ─── Normal traffic ranges (for synthetic data) ──────────
NORMAL_RANGES = {
    'conn_count':          (2, 50),
    'unique_dst_ports':    (1, 10),
    'unique_dst_ips':      (1, 5),
    'syn_ratio':           (0.0, 0.1),
    'failed_ratio':        (0.0, 0.1),
    'bytes_total':         (1_000, 100_000_000), # Up to 100MB per window
    'packets_total':       (10, 50_000),
    'avg_duration':        (0.1, 120.0),
    'connections_per_sec': (0.1, 5.0),
    'avg_bytes_per_flow':  (100, 1_000_000),
    'dst_port_entropy':    (0.0, 2.0),
    'dst_ip_entropy':      (0.0, 1.5),
}

NUM_SAMPLES = 8000
LOG_FEATURES = ['bytes_total', 'packets_total', 'avg_bytes_per_flow', 'conn_count', 'connections_per_sec']


# ─── Synthetic data generation ───────────────────────────
def generate_normal_data(n_samples: int) -> np.ndarray:
    """Generate synthetic normal traffic windows."""
    print(f"[*] Generating {n_samples} synthetic normal windows...")
    rng = np.random.default_rng(seed=42)
    data = np.zeros((n_samples, len(FEATURE_NAMES)))

    for i, name in enumerate(FEATURE_NAMES):
        lo, hi = NORMAL_RANGES[name]
        if name in ('conn_count', 'unique_dst_ports', 'unique_dst_ips', 'packets_total'):
            # Integer features — use uniform ints
            data[:, i] = rng.integers(int(lo), int(hi) + 1, size=n_samples).astype(float)
        else:
            # Float features — use uniform floats
            data[:, i] = rng.uniform(lo, hi, size=n_samples)

    # Enforce consistency: avg_bytes_per_flow ≤ bytes_total / conn_count
    conn_idx  = FEATURE_NAMES.index('conn_count')
    bytes_idx = FEATURE_NAMES.index('bytes_total')
    avg_b_idx = FEATURE_NAMES.index('avg_bytes_per_flow')
    data[:, avg_b_idx] = np.minimum(
        data[:, avg_b_idx],
        data[:, bytes_idx] / np.maximum(data[:, conn_idx], 1)
    )

    print(f"[+] Generated data shape: {data.shape}")
    return data


# ─── Build autoencoder ───────────────────────────────────
def build_autoencoder(input_dim: int) -> keras.Model:
    """10 → 32 → 16 → 8 → 16 → 32 → 10 autoencoder."""
    inputs = keras.Input(shape=(input_dim,))
    # Encoder
    x = layers.Dense(32, activation='relu')(inputs)
    x = layers.Dense(16, activation='relu')(x)
    x = layers.Dense(8,  activation='relu')(x)      # bottleneck
    # Decoder
    x = layers.Dense(16, activation='relu')(x)
    x = layers.Dense(32, activation='relu')(x)
    outputs = layers.Dense(input_dim, activation='linear')(x)

    model = keras.Model(inputs, outputs, name='window_autoencoder')
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',
    )
    return model


# ─── Main ─────────────────────────────────────────────────
def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    # 1. Generate data
    data = generate_normal_data(NUM_SAMPLES)

    # 2. Log-scale heavy features
    print(f"[*] Applying log-scaling to: {LOG_FEATURES}")
    for feature in LOG_FEATURES:
        idx = FEATURE_NAMES.index(feature)
        data[:, idx] = np.log1p(data[:, idx])

    # 3. Fit scaler
    print("[*] Fitting RobustScaler...")
    scaler = RobustScaler()
    data_scaled = scaler.fit_transform(data)
    joblib.dump(scaler, SCALER_PATH)
    print(f"[+] Scaler saved to {SCALER_PATH}")

    # 3. Build & train
    model = build_autoencoder(input_dim=len(FEATURE_NAMES))
    model.summary()

    print("[*] Training autoencoder...")
    history = model.fit(
        data_scaled, data_scaled,
        epochs=100,
        batch_size=64,
        validation_split=0.1,
        verbose=1,
    )

    # 4. Save model
    model.save(MODEL_PATH)
    print(f"[+] Model saved to {MODEL_PATH}")

    # 5. Compute threshold (99th percentile of reconstruction errors)
    print("[*] Computing reconstruction threshold...")
    predictions = model.predict(data_scaled, verbose=0)
    mse_errors = np.mean(np.square(data_scaled - predictions), axis=1)
    threshold = float(np.percentile(mse_errors, 99))
    print(f"[+] Threshold (99th percentile): {threshold:.6f}")
    print(f"    Mean error:  {np.mean(mse_errors):.6f}")
    print(f"    Max error:   {np.max(mse_errors):.6f}")

    # 6. Save metadata
    metadata = {
        'reconstruction_threshold': threshold,
        'feature_names': FEATURE_NAMES,
        'log_features': LOG_FEATURES,
        'window_size': WINDOW_SIZE,
        'training_samples': NUM_SAMPLES,
        'mean_error': float(np.mean(mse_errors)),
        'max_error': float(np.max(mse_errors)),
    }
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"[+] Metadata saved to {METADATA_PATH}")

    print("\n[+] Training complete! Files created:")
    print(f"    {MODEL_PATH}")
    print(f"    {SCALER_PATH}")
    print(f"    {METADATA_PATH}")


if __name__ == '__main__':
    main()
