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

# ─── Removed static normal ranges, using distributions directly ──────────

NUM_SAMPLES = 8000
LOG_FEATURES = [
    'bytes_total', 'packets_total', 'avg_bytes_per_flow', 
    'conn_count', 'connections_per_sec',
    'avg_duration', 'unique_dst_ports', 'unique_dst_ips'
]


# ─── Synthetic data generation ───────────────────────────
def generate_normal_data(n_samples: int) -> np.ndarray:
    """Generate synthetic normal traffic windows."""
    print(f"[*] Generating {n_samples} synthetic normal windows...")
    rng = np.random.default_rng(seed=42)
    data = np.zeros((n_samples, len(FEATURE_NAMES)))

    for i, name in enumerate(FEATURE_NAMES):
        if name == 'conn_count':
            # Use lognormal to allow for massive connection spikes (e.g. 5000+ connections)
            data[:, i] = rng.lognormal(mean=2.0, sigma=2.0, size=n_samples) + 1
        elif name == 'unique_dst_ports':
            # Allow for massive port sweeps (e.g. 1000+ ports)
            data[:, i] = rng.lognormal(mean=1.0, sigma=2.0, size=n_samples) + 1
        elif name == 'unique_dst_ips':
            # Allow for subnet sweeps (e.g. 200+ IPs)
            data[:, i] = rng.lognormal(mean=1.0, sigma=2.0, size=n_samples) + 1
        elif name == 'syn_ratio':
            data[:, i] = rng.uniform(0.0, 0.1, size=n_samples)
        elif name == 'failed_ratio':
            data[:, i] = rng.uniform(0.0, 0.05, size=n_samples)
        elif name == 'bytes_total':
            data[:, i] = rng.lognormal(mean=7.0, sigma=2.0, size=n_samples)
        elif name == 'packets_total':
            data[:, i] = rng.lognormal(mean=3.0, sigma=1.5, size=n_samples)
        elif name == 'avg_duration':
            data[:, i] = rng.exponential(scale=5.0, size=n_samples)
        elif name == 'connections_per_sec':
            data[:, i] = rng.exponential(scale=0.5, size=n_samples)
        elif name == 'avg_bytes_per_flow':
            data[:, i] = rng.lognormal(mean=6.0, sigma=1.5, size=n_samples)
        elif name == 'dst_port_entropy':
            data[:, i] = rng.uniform(0.0, 1.0, size=n_samples)
        elif name == 'dst_ip_entropy':
            data[:, i] = rng.uniform(0.0, 1.0, size=n_samples)

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
