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
from sklearn.preprocessing import MinMaxScaler

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
]

WINDOW_SIZE = 30   # seconds

# ─── Normal traffic ranges (for synthetic data) ──────────
NORMAL_RANGES = {
    'conn_count':          (5, 30),
    'unique_dst_ports':    (1, 5),
    'unique_dst_ips':      (1, 3),
    'syn_ratio':           (0.0, 0.1),
    'failed_ratio':        (0.0, 0.05),
    'bytes_total':         (1_000, 50_000),
    'packets_total':       (10, 200),
    'avg_duration':        (1.0, 60.0),
    'connections_per_sec': (0.1, 2.0),
    'avg_bytes_per_flow':  (100, 5_000),
}

NUM_SAMPLES = 5000


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

    # 2. Fit scaler
    print("[*] Fitting MinMaxScaler...")
    scaler = MinMaxScaler()
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

    # 5. Compute threshold (95th percentile of reconstruction errors)
    print("[*] Computing reconstruction threshold...")
    predictions = model.predict(data_scaled, verbose=0)
    mse_errors = np.mean(np.square(data_scaled - predictions), axis=1)
    threshold = float(np.percentile(mse_errors, 95))
    print(f"[+] Threshold (95th percentile): {threshold:.6f}")
    print(f"    Mean error:  {np.mean(mse_errors):.6f}")
    print(f"    Max error:   {np.max(mse_errors):.6f}")

    # 6. Save metadata
    metadata = {
        'reconstruction_threshold': threshold,
        'feature_names': FEATURE_NAMES,
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
