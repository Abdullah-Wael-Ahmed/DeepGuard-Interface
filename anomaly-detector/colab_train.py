"""
DeepGuard Anomaly Detector - Google Colab Training Script

Instructions for Colab:
1. Open Google Colab (https://colab.research.google.com/) and create a new notebook.
2. Ensure you have the 4 raw UNSW-NB15 CSV files (UNSW-NB15_1.csv to UNSW-NB15_4.csv) available.
   - If using Google Drive, upload them to a folder, and mount your drive in Colab:
     from google.colab import drive
     drive.mount('/content/drive')
   - Update the `RAW_DIR` variable below to point to the directory containing the CSVs.
3. Paste this entire script into a single cell and run it.
4. After it finishes, download the generated model files from the `model/` folder in Colab:
   - model/window_autoencoder.keras
   - model/window_scaler.pkl
   - model/window_metadata.json
5. Replace the existing files in your local Kali machine (`DeepGuard-Interface-main/anomaly-detector/model/`) with these new ones.
6. Rebuild your docker image: `sudo docker-compose build anomaly` and restart it: `sudo docker-compose up -d anomaly`
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import MinMaxScaler
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# --- Configuration ---
WINDOW_SIZE = 30
RAW_DIR = '.'  # Change this to your Google Drive path containing the CSVs
OUTPUT_DIR = 'data'
MODEL_DIR = 'model'

RAW_FILES = [f'UNSW-NB15_{i}.csv' for i in range(1, 5)]

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
    'tcp_ratio',
    'avg_pkt_size',
    'inbound_outbound_ratio',
    'proto_diversity',
]

LOG_FEATURES = ['bytes_total', 'packets_total', 'avg_bytes_per_flow', 'avg_pkt_size']

UNSW_COLUMNS = [
    'srcip', 'sport', 'dstip', 'dsport', 'proto', 'state', 'dur',
    'sbytes', 'dbytes', 'sttl', 'dttl', 'sloss', 'dloss', 'service',
    'Sload', 'Dload', 'Spkts', 'Dpkts', 'swin', 'dwin', 'stcpb',
    'dtcpb', 'smeansz', 'dmeansz', 'trans_depth', 'res_bdy_len',
    'Sjit', 'Djit', 'Stime', 'Ltime', 'Sintpkt', 'Dintpkt',
    'tcprtt', 'synack', 'ackdat', 'is_sm_ips_ports', 'ct_state_ttl',
    'ct_flw_http_mthd', 'is_ftp_login', 'ct_ftp_cmd', 'ct_srv_src',
    'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 'ct_src_dport_ltm',
    'ct_dst_sport_ltm', 'ct_dst_src_ltm', 'attack_cat', 'Label'
]

def load_raw_data():
    """Load all 4 UNSW-NB15 raw CSV files."""
    dfs = []
    for fname in RAW_FILES:
        path = os.path.join(RAW_DIR, fname)
        if not os.path.exists(path):
            print(f"[!] Warning: {path} not found. Skipping.")
            continue
        print(f"Loading {path}...")
        df = pd.read_csv(path, header=None, names=UNSW_COLUMNS,
                         low_memory=False, on_bad_lines='skip')
        dfs.append(df)
    
    if not dfs:
        raise FileNotFoundError(f"No CSV files found in {RAW_DIR}")
    return pd.concat(dfs, ignore_index=True)

def aggregate_window(flows_df):
    """Compute 14 features from a DataFrame of flows."""
    n = len(flows_df)
    if n == 0:
        return None
    
    sbytes = pd.to_numeric(flows_df['sbytes'], errors='coerce').fillna(0)
    dbytes = pd.to_numeric(flows_df['dbytes'], errors='coerce').fillna(0)
    spkts = pd.to_numeric(flows_df['Spkts'], errors='coerce').fillna(0)
    dpkts = pd.to_numeric(flows_df['Dpkts'], errors='coerce').fillna(0)
    dur = pd.to_numeric(flows_df['dur'], errors='coerce').fillna(0)
    smeansz = pd.to_numeric(flows_df['smeansz'], errors='coerce').fillna(0)
    dmeansz = pd.to_numeric(flows_df['dmeansz'], errors='coerce').fillna(0)
    
    bytes_total = float((sbytes + dbytes).sum())
    packets_total = float((spkts + dpkts).sum())
    
    states = flows_df['state'].astype(str).str.strip()
    syn_states = states.isin(['REQ', 'INT'])
    completed_states = states.isin(['CON', 'FIN', 'CLO', 'ACC'])
    
    protos = flows_df['proto'].astype(str).str.strip().str.lower()
    tcp_count = (protos == 'tcp').sum()
    
    return {
        'conn_count': float(n),
        'unique_dst_ports': float(flows_df['dsport'].nunique()),
        'unique_dst_ips': float(flows_df['dstip'].nunique()),
        'syn_ratio': float(syn_states.sum() / n),
        'failed_ratio': float((~completed_states).sum() / n),
        'bytes_total': bytes_total,
        'packets_total': packets_total,
        'avg_duration': float(dur.mean()),
        'connections_per_sec': n / WINDOW_SIZE,
        'avg_bytes_per_flow': bytes_total / n if n > 0 else 0.0,
        'tcp_ratio': float(tcp_count / n),
        'avg_pkt_size': float(bytes_total / packets_total) if packets_total > 0 else 0.0,
        'inbound_outbound_ratio': float(dbytes.sum() / max(sbytes.sum(), 1)),
        'proto_diversity': float(protos.nunique()),
    }

def create_windows(df):
    """Group flows into 30-second windows per source IP."""
    print("Creating windows...")
    df['Stime_num'] = pd.to_numeric(df['Stime'], errors='coerce')
    df = df.dropna(subset=['Stime_num'])
    
    # Compute window ID: floor(timestamp / 30)
    df['window_id'] = (df['Stime_num'] // WINDOW_SIZE).astype(int)
    df['Label_num'] = pd.to_numeric(df['Label'], errors='coerce').fillna(0).astype(int)
    
    windows_normal = []
    windows_attack = []
    
    grouped = df.groupby(['srcip', 'window_id'])
    count = 0
    total = len(grouped)
    
    for (srcip, wid), group in grouped:
        count += 1
        if count % 10000 == 0:
            print(f"Processed {count}/{total} windows...")
            
        if len(group) < 2:  # Skip windows with only 1 flow
            continue
            
        features = aggregate_window(group)
        if features is None:
            continue
        
        # Determine window label
        attack_ratio = group['Label_num'].mean()
        is_attack = attack_ratio >= 0.5
        
        features['srcip'] = srcip
        features['window_id'] = wid
        features['attack_ratio'] = attack_ratio
        
        if is_attack:
            attack_cats = group.loc[group['Label_num'] == 1, 'attack_cat'].dropna().astype(str).str.strip()
            mode_result = attack_cats.mode()
            features['attack_cat'] = mode_result.iloc[0] if len(mode_result) > 0 else 'Unknown'
            windows_attack.append(features)
        else:
            features['attack_cat'] = ''
            windows_normal.append(features)
            
    print(f"Created {len(windows_normal)} normal windows and {len(windows_attack)} attack windows.")
    return pd.DataFrame(windows_normal), pd.DataFrame(windows_attack)

def build_autoencoder(input_dim):
    inputs = keras.Input(shape=(input_dim,))
    # Encoder
    x = layers.Dense(64, activation='relu')(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Dense(32, activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Dense(8, activation='relu')(x)   # bottleneck
    # Decoder
    x = layers.Dense(32, activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(64, activation='relu')(x)
    outputs = layers.Dense(input_dim, activation='linear')(x)
    
    model = keras.Model(inputs, outputs, name='window_autoencoder')
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.0005),
        loss='mse',
    )
    return model

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # --- PHASE 1: Data Preparation ---
    print("\n" + "="*50)
    print("PHASE 1: Data Preparation")
    print("="*50)
    df = load_raw_data()
    print(f"Total flows loaded: {len(df)}")
    
    normal_df, attack_df = create_windows(df)
    
    normal_df.to_csv(os.path.join(OUTPUT_DIR, 'normal_windows.csv'), index=False)
    if len(attack_df) > 0:
        attack_df.to_csv(os.path.join(OUTPUT_DIR, 'attack_windows.csv'), index=False)
    
    # --- PHASE 2: Training ---
    print("\n" + "="*50)
    print("PHASE 2: Model Training")
    print("="*50)
    
    X_normal = normal_df[FEATURE_NAMES].values.astype(np.float32)
    X_attack = attack_df[FEATURE_NAMES].values.astype(np.float32) if len(attack_df) > 0 else None
    
    X_normal = np.nan_to_num(X_normal, nan=0.0, posinf=0.0, neginf=0.0)
    if X_attack is not None:
        X_attack = np.nan_to_num(X_attack, nan=0.0, posinf=0.0, neginf=0.0)
    
    for feat in LOG_FEATURES:
        idx = FEATURE_NAMES.index(feat)
        X_normal[:, idx] = np.log1p(X_normal[:, idx])
        if X_attack is not None:
            X_attack[:, idx] = np.log1p(X_attack[:, idx])
            
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X_normal)
    
    # Shuffle before split
    np.random.seed(42)
    shuffle_idx = np.random.permutation(len(X_scaled))
    X_scaled_shuffled = X_scaled[shuffle_idx]
    
    split = int(0.9 * len(X_scaled_shuffled))
    X_train, X_val = X_scaled_shuffled[:split], X_scaled_shuffled[split:]
    
    model = build_autoencoder(input_dim=len(FEATURE_NAMES))
    
    early_stop = keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=10, restore_best_weights=True
    )
    
    print("Training autoencoder on normal windows...")
    history = model.fit(
        X_train, X_train,
        epochs=100,
        batch_size=128,
        validation_data=(X_val, X_val),
        callbacks=[early_stop],
        verbose=1,
    )
    
    # --- PHASE 3: Threshold Calibration ---
    print("\n" + "="*50)
    print("PHASE 3: Threshold Calibration")
    print("="*50)
    
    predictions_normal = model.predict(X_scaled, verbose=0)
    errors_normal = np.mean(np.square(X_scaled - predictions_normal), axis=1)
    
    if X_attack is not None and len(X_attack) > 0:
        X_attack_scaled = scaler.transform(X_attack)
        predictions_attack = model.predict(X_attack_scaled, verbose=0)
        errors_attack = np.mean(np.square(X_attack_scaled - predictions_attack), axis=1)
        
        best_f1, best_threshold = 0, np.percentile(errors_normal, 99)
        for pct in np.arange(95, 99.9, 0.1):
            t = np.percentile(errors_normal, pct)
            tp = (errors_attack > t).sum()
            fp = (errors_normal > t).sum()
            fn = (errors_attack <= t).sum()
            precision = tp / max(tp + fp, 1)
            recall = tp / max(tp + fn, 1)
            f1 = 2 * precision * recall / max(precision + recall, 1e-8)
            if f1 > best_f1:
                best_f1, best_threshold = f1, t
        
        threshold = best_threshold
        
        print(f"Normal windows: {len(errors_normal)}")
        print(f"Attack windows: {len(errors_attack)}")
        print(f"Threshold: {threshold:.6f}")
        print(f"Best F1: {best_f1:.4f}")
        
        print("\nPer-category detection rates:")
        for cat in attack_df['attack_cat'].unique():
            cat_mask = attack_df['attack_cat'] == cat
            cat_errors = errors_attack[cat_mask.values[:len(errors_attack)]]
            if len(cat_errors) > 0:
                detected = (cat_errors > threshold).sum()
                print(f"  {cat:20s}: {detected}/{len(cat_errors)} ({100*detected/len(cat_errors):.1f}%) detected")
    else:
        threshold = float(np.percentile(errors_normal, 99))
        print(f"No attack data found. Using 99th percentile threshold: {threshold:.6f}")

    # --- PHASE 4: Save ---
    model_path = os.path.join(MODEL_DIR, 'window_autoencoder.keras')
    scaler_path = os.path.join(MODEL_DIR, 'window_scaler.pkl')
    metadata_path = os.path.join(MODEL_DIR, 'window_metadata.json')
    
    model.save(model_path)
    joblib.dump(scaler, scaler_path)
    
    metadata = {
        'reconstruction_threshold': float(threshold),
        'feature_names': FEATURE_NAMES,
        'log_features': LOG_FEATURES,
        'window_size': WINDOW_SIZE,
        'training_samples': len(X_normal),
        'mean_error': float(errors_normal.mean()),
        'max_error': float(errors_normal.max()),
        'std_error': float(errors_normal.std()),
        'threshold_method': 'f1_optimized' if X_attack is not None else '99th_percentile',
    }
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print("\nTraining complete! Please download the 3 files from the model/ directory.")

if __name__ == '__main__':
    main()
