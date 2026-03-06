import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder
import joblib
import os
import sys

# ─── Paths ────────────────────────────────────────────────
DATA_PATH  = 'data/dataset.csv'
MODEL_PATH = 'model/isolation_forest.pkl'
ENC_PATH   = 'model/label_encoders.pkl'

# ─── Features we use from CIC-IDS2017 ────────────────────
FEATURES = [
    'Flow Duration',
    'Total Fwd Packets',
    'Total Backward Packets',
    'Total Length of Fwd Packets',
    'Total Length of Bwd Packets',
    'Fwd Packet Length Max',
    'Bwd Packet Length Max',
    'Flow Bytes/s',
    'Flow Packets/s',
    'Flow IAT Mean',
    'Destination Port',
]

def load_and_clean(path):
    print(f"[*] Loading dataset from {path} ...")
    df = pd.read_csv(path, encoding='utf-8', low_memory=False)

    # Strip column name spaces (CIC-IDS2017 has leading spaces)
    df.columns = df.columns.str.strip()

    print(f"[*] Columns found: {list(df.columns)}")
    print(f"[*] Shape: {df.shape}")

    # Keep only the features we need
    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        print(f"[!] Missing columns: {missing}")
        sys.exit(1)

    df = df[FEATURES].copy()

    # Replace inf and NaN with 0
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.fillna(0, inplace=True)

    return df

def train(df):
    print("[*] Training Isolation Forest ...")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,   # assume 5% of traffic is anomalous
        random_state=42,
        n_jobs=-1             # use all CPU cores
    )
    model.fit(df)
    print("[+] Training complete.")
    return model

def save(model):
    os.makedirs('model', exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"[+] Model saved to {MODEL_PATH}")

if __name__ == '__main__':
    df     = load_and_clean(DATA_PATH)
    model  = train(df)
    save(model)
    print("[+] Done. You can now run detector.py")
