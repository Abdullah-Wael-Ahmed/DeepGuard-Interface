"""
Train the window-based Autoencoder directly on live Zeek traffic logs.
This builds a true baseline for the exact environment, rather than guessing via synthetic data.
"""

import os
import json
import math
import numpy as np
import joblib
from collections import defaultdict, Counter
from sklearn.preprocessing import RobustScaler

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

LOG_FILE      = '/app/logs/zeek/conn.log'
MODEL_DIR     = 'model'
MODEL_PATH    = os.path.join(MODEL_DIR, 'window_autoencoder.keras')
SCALER_PATH   = os.path.join(MODEL_DIR, 'window_scaler.pkl')
METADATA_PATH = os.path.join(MODEL_DIR, 'window_metadata.json')

WINDOW_SECONDS = 30

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

LOG_FEATURES = [
    'bytes_total', 'packets_total', 'avg_bytes_per_flow', 
    'conn_count', 'connections_per_sec',
    'avg_duration', 'unique_dst_ports', 'unique_dst_ips'
]

def _calculate_entropy(items):
    if not items: return 0.0
    counts = Counter(items)
    n = len(items)
    entropy = 0.0
    for count in counts.values():
        p = count / n
        entropy -= p * math.log2(p)
    return entropy

def _aggregate(flows: list) -> dict:
    n = len(flows)
    if n == 0: return None

    dst_ports   = [f.get('dst_port', 0) for f in flows]
    dst_ips     = [f.get('dst_ip', '') for f in flows]
    conn_states = [f.get('conn_state', 'unknown') for f in flows]
    durations   = [f.get('duration', 0.0) for f in flows]
    bytes_sent_list = [f.get('bytes_sent', 0) for f in flows]
    bytes_recv_list = [f.get('bytes_received', 0) for f in flows]
    bytes_list  = [s + r for s, r in zip(bytes_sent_list, bytes_recv_list)]
    packets_list = [f.get('total_fwd_packets', 0) + f.get('total_backward_packets', 0) for f in flows]
    protos      = [f.get('protocol', 'unknown') for f in flows]

    bytes_total   = sum(bytes_list)
    packets_total = sum(packets_list)
    syn_count     = sum(1 for s in conn_states if s == 'S0')
    failed_count  = sum(1 for s in conn_states if s != 'SF')

    return {
        'conn_count':          float(n),
        'unique_dst_ports':    float(len(set(dst_ports))),
        'unique_dst_ips':      float(len(set(dst_ips))),
        'syn_ratio':           syn_count / n,
        'failed_ratio':        failed_count / n,
        'bytes_total':         float(bytes_total),
        'packets_total':       float(packets_total),
        'avg_duration':        float(np.mean(durations)) if durations else 0.0,
        'connections_per_sec': n / WINDOW_SECONDS,
        'avg_bytes_per_flow':  bytes_total / n if n > 0 else 0.0,
        'dst_port_entropy':    float(_calculate_entropy(dst_ports)),
        'dst_ip_entropy':      float(_calculate_entropy(dst_ips)),
    }

def parse_zeek_logs(filepath):
    print(f"[*] Parsing Zeek logs from {filepath}...")
    if not os.path.exists(filepath):
        print(f"[!] Error: {filepath} not found. Is it mounted?")
        return []

    windows = defaultdict(list)
    fields = []
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            
            if line.startswith('{'):
                try:
                    record = json.loads(line)
                    ts = float(record['ts'])
                    src_ip = record.get('id.orig_h', record.get('id', {}).get('orig_h'))
                    
                    flow = {
                        'dst_ip': record.get('id.resp_h', record.get('id', {}).get('resp_h')),
                        'dst_port': int(record.get('id.resp_p', record.get('id', {}).get('resp_p', 0))),
                        'conn_state': record.get('conn_state', 'unknown'),
                        'duration': float(record.get('duration', 0.0)),
                        'bytes_sent': int(record.get('orig_bytes', 0)),
                        'bytes_received': int(record.get('resp_bytes', 0)),
                        'total_fwd_packets': int(record.get('orig_pkts', 0)),
                        'total_backward_packets': int(record.get('resp_pkts', 0)),
                        'protocol': record.get('proto', 'unknown').lower(),
                        'timestamp': ts
                    }
                    window_idx = int(ts // WINDOW_SECONDS)
                    windows[(src_ip, window_idx)].append(flow)
                except Exception as e:
                    continue
            else:
                if line.startswith('#'):
                    if line.startswith('#fields'):
                        fields = line.split('\t')[1:]
                    continue
                
                parts = line.split('\t')
                if len(parts) != len(fields):
                    continue
                    
                record = dict(zip(fields, parts))
                try:
                    ts = float(record['ts'])
                    src_ip = record['id.orig_h']
                    
                    flow = {
                        'dst_ip': record['id.resp_h'],
                        'dst_port': int(record['id.resp_p']),
                        'conn_state': record['conn_state'],
                        'duration': float(record['duration']) if record.get('duration', '-') != '-' else 0.0,
                        'bytes_sent': int(record['orig_bytes']) if record.get('orig_bytes', '-') != '-' else 0,
                        'bytes_received': int(record['resp_bytes']) if record.get('resp_bytes', '-') != '-' else 0,
                        'total_fwd_packets': int(record['orig_pkts']) if record.get('orig_pkts', '-') != '-' else 0,
                        'total_backward_packets': int(record['resp_pkts']) if record.get('resp_pkts', '-') != '-' else 0,
                        'protocol': record['proto'].lower() if record.get('proto') else 'unknown',
                        'timestamp': ts
                    }
                    window_idx = int(ts // WINDOW_SECONDS)
                    windows[(src_ip, window_idx)].append(flow)
                except (ValueError, KeyError) as e:
                    continue

    print(f"[+] Found {len(windows)} unique windows.")
    
    data = []
    for (src_ip, w_idx), flows in windows.items():
        agg = _aggregate(flows)
        if agg:
            row = [agg[name] for name in FEATURE_NAMES]
            data.append(row)
            
    return np.array(data, dtype=np.float32)

def build_autoencoder(input_dim: int) -> keras.Model:
    inputs = keras.Input(shape=(input_dim,))
    x = layers.Dense(32, activation='relu')(inputs)
    x = layers.Dense(16, activation='relu')(x)
    x = layers.Dense(8,  activation='relu')(x)
    x = layers.Dense(16, activation='relu')(x)
    x = layers.Dense(32, activation='relu')(x)
    outputs = layers.Dense(input_dim, activation='linear')(x)
    model = keras.Model(inputs, outputs)
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.001), loss='mse')
    return model

def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    data = parse_zeek_logs(LOG_FILE)
    if len(data) == 0:
        print("[!] No data extracted. Aborting.")
        return

    print(f"[*] Extracted shape: {data.shape}")

    # Log scale
    for feature in LOG_FEATURES:
        idx = FEATURE_NAMES.index(feature)
        data[:, idx] = np.log1p(data[:, idx])

    # Scale
    print("[*] Fitting RobustScaler...")
    scaler = RobustScaler()
    data_scaled = scaler.fit_transform(data)
    joblib.dump(scaler, SCALER_PATH)

    # Build & train
    model = build_autoencoder(input_dim=len(FEATURE_NAMES))
    
    # If not enough windows, increase epochs or duplicate data for stability
    epochs = 100
    if len(data) < 1000:
        epochs = 300

    print("[*] Training autoencoder...")
    model.fit(
        data_scaled, data_scaled,
        epochs=epochs,
        batch_size=64,
        validation_split=0.1 if len(data) > 100 else 0.0,
        verbose=1,
    )

    model.save(MODEL_PATH)
    print(f"[+] Model saved to {MODEL_PATH}")

    # Compute threshold
    print("[*] Computing reconstruction threshold...")
    predictions = model.predict(data_scaled, verbose=0)
    mse_errors = np.mean(np.square(data_scaled - predictions), axis=1)
    
    # 99th percentile or higher if data is small
    threshold = float(np.percentile(mse_errors, 99))
    # Ensure a minimum threshold so it doesn't trigger on every slight variation if data is extremely homogenous
    threshold = max(threshold, 0.05)
    
    print(f"[+] Threshold (99th percentile): {threshold:.6f}")

    metadata = {
        'reconstruction_threshold': threshold,
        'feature_names': FEATURE_NAMES,
        'log_features': LOG_FEATURES,
        'window_size': WINDOW_SECONDS,
        'training_samples': len(data),
    }
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"[+] Complete!")

if __name__ == '__main__':
    main()
